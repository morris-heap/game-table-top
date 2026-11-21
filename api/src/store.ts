// Postgres implementation of CharacterStore: emberreach.characters plus child tables
// (skills, wounds, attacks, talents, spells). A save replaces the whole sheet in one transaction.
import type { Client } from 'pg'
import type { CharacterStore } from './handler.ts'
import type { AttributeKey, CharacterRecord, CharacterSheet, CharacterSummary } from './sheet.ts'

// Reads one character with its child rows aggregated, so a GET is a single round trip.
const SELECT_FULL = `
select c.*,
  coalesce((select json_agg(w.attribute order by w.slot)
              from emberreach.character_wounds w where w.character_id = c.id), '[]') as wounds,
  coalesce((select json_object_agg(s.skill, s.rank)
              from emberreach.character_skills s where s.character_id = c.id), '{}') as skills,
  coalesce((select json_agg(json_build_object('name', a.name, 'testBonus', a.test_bonus,
                                              'damage', a.damage, 'notes', a.notes) order by a.position)
              from emberreach.character_attacks a where a.character_id = c.id), '[]') as attacks,
  coalesce((select json_agg(t.name order by t.position)
              from emberreach.character_talents t where t.character_id = c.id), '[]') as talents,
  coalesce((select json_agg(json_build_object('name', p.name, 'ember', p.ember,
                                              'target', p.target, 'effect', p.effect) order by p.position)
              from emberreach.character_spells p where p.character_id = c.id), '[]') as spells
from emberreach.characters c
where c.id = $1 and c.owner_id = $2`

interface Row {
  id: string; owner_id: string; rules_version: string
  name: string; player: string; level: number; ancestry: string; calling: string; background: string; oath: string
  might: number; grace: number; wits: number; lore: number; spirit: number; presence: number
  grit: number; ember: number; death_fails: number; signature: string
  armor: string; shield: boolean; silver: number; supply_die: string; gear: string
  contacts: string; notes: string; created_at: Date; updated_at: Date
  wounds: string[]; skills: Record<string, number>; attacks: CharacterSheet['attacks']
  talents: string[]; spells: CharacterSheet['spells']
}

function toRecord(r: Row): CharacterRecord {
  const attributes: Record<AttributeKey, number> = {
    might: r.might, grace: r.grace, wits: r.wits, lore: r.lore, spirit: r.spirit, presence: r.presence,
  }
  return {
    id: r.id, ownerId: r.owner_id, rulesVersion: r.rules_version,
    name: r.name, player: r.player, level: r.level, ancestry: r.ancestry, calling: r.calling,
    background: r.background, oath: r.oath, attributes,
    grit: r.grit, ember: r.ember, deathFails: r.death_fails,
    wounds: r.wounds, skills: r.skills, attacks: r.attacks,
    signature: r.signature, talents: r.talents, spells: r.spells,
    armor: r.armor, shield: r.shield, silver: r.silver, supplyDie: r.supply_die, gear: r.gear,
    contacts: r.contacts, notes: r.notes,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  }
}

export class PgCharacterStore implements CharacterStore {
  /** `db` connects lazily, so bad requests don't open a connection they don't need. */
  constructor(private db: () => Promise<Client>) {}

  async ping() {
    await (await this.db()).query('select 1')
  }

  async list(ownerId: string): Promise<CharacterSummary[]> {
    const { rows } = await (await this.db()).query(
      `select id, name, level, ancestry, calling, updated_at
         from emberreach.characters where owner_id = $1 order by updated_at desc limit 200`,
      [ownerId],
    )
    return rows.map(r => ({
      id: r.id, name: r.name, level: r.level, ancestry: r.ancestry, calling: r.calling,
      updatedAt: (r.updated_at as Date).toISOString(),
    }))
  }

  async get(ownerId: string, id: string) {
    const { rows } = await (await this.db()).query<Row>(SELECT_FULL, [id, ownerId])
    return rows[0] ? toRecord(rows[0]) : null
  }

  async save(ownerId: string, id: string, s: CharacterSheet) {
    const db = await this.db()
    await db.query('begin')
    try {
      const a = s.attributes
      // The WHERE on the conflict branch stops one owner overwriting another owner's character.
      const up = await db.query(
        `insert into emberreach.characters (
           id, owner_id, rules_version, name, player, level, ancestry, calling, background, oath,
           might, grace, wits, lore, spirit, presence, grit, ember, death_fails, signature,
           armor, shield, silver, supply_die, gear, contacts, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
         on conflict (id) do update set
           rules_version = excluded.rules_version, name = excluded.name, player = excluded.player,
           level = excluded.level, ancestry = excluded.ancestry, calling = excluded.calling,
           background = excluded.background, oath = excluded.oath,
           might = excluded.might, grace = excluded.grace, wits = excluded.wits, lore = excluded.lore,
           spirit = excluded.spirit, presence = excluded.presence,
           grit = excluded.grit, ember = excluded.ember, death_fails = excluded.death_fails,
           signature = excluded.signature, armor = excluded.armor, shield = excluded.shield,
           silver = excluded.silver, supply_die = excluded.supply_die, gear = excluded.gear,
           contacts = excluded.contacts, notes = excluded.notes, updated_at = now()
         where emberreach.characters.owner_id = excluded.owner_id
         returning id`,
        [id, ownerId, s.rulesVersion, s.name, s.player, s.level, s.ancestry, s.calling, s.background, s.oath,
          a.might, a.grace, a.wits, a.lore, a.spirit, a.presence, s.grit, s.ember, s.deathFails, s.signature,
          s.armor, s.shield, s.silver, s.supplyDie, s.gear, s.contacts, s.notes],
      )
      if (up.rowCount === 0) {
        await db.query('rollback')
        return null
      }

      // Replace child rows. unnest() inserts each list in one statement.
      for (const t of ['skills', 'wounds', 'attacks', 'talents', 'spells']) {
        await db.query(`delete from emberreach.character_${t} where character_id = $1`, [id])
      }
      const skills = Object.entries(s.skills)
      await db.query(
        `insert into emberreach.character_skills (character_id, skill, rank)
         select $1, * from unnest($2::text[], $3::smallint[])`,
        [id, skills.map(([k]) => k), skills.map(([, v]) => v)],
      )
      await db.query(
        `insert into emberreach.character_wounds (character_id, slot, attribute)
         select $1, ord, attr from unnest($2::text[]) with ordinality as t(attr, ord)`,
        [id, s.wounds],
      )
      await db.query(
        `insert into emberreach.character_attacks (character_id, position, name, test_bonus, damage, notes)
         select $1, ord, n, b, d, x from unnest($2::text[], $3::smallint[], $4::text[], $5::text[])
           with ordinality as t(n, b, d, x, ord)`,
        [id, s.attacks.map(x => x.name), s.attacks.map(x => x.testBonus), s.attacks.map(x => x.damage), s.attacks.map(x => x.notes)],
      )
      await db.query(
        `insert into emberreach.character_talents (character_id, position, name)
         select $1, ord, n from unnest($2::text[]) with ordinality as t(n, ord)`,
        [id, s.talents],
      )
      await db.query(
        `insert into emberreach.character_spells (character_id, position, name, ember, target, effect)
         select $1, ord, n, e, g, f from unnest($2::text[], $3::smallint[], $4::text[], $5::text[])
           with ordinality as t(n, e, g, f, ord)`,
        [id, s.spells.map(x => x.name), s.spells.map(x => x.ember), s.spells.map(x => x.target), s.spells.map(x => x.effect)],
      )

      const { rows } = await db.query<Row>(SELECT_FULL, [id, ownerId])
      await db.query('commit')
      return toRecord(rows[0])
    } catch (err) {
      await db.query('rollback').catch(() => {})
      throw err
    }
  }

  async delete(ownerId: string, id: string) {
    // Child rows go with it (on delete cascade).
    const res = await (await this.db()).query(
      `delete from emberreach.characters where id = $1 and owner_id = $2`,
      [id, ownerId],
    )
    return (res.rowCount ?? 0) > 0
  }
}
