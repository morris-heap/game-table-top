-- Character sheets as relational tables (one column per sheet field; lists in child tables).
-- Fields follow sheets/character-sheet.md. Game values (skill names, armor types, level range…)
-- are validated by the API from /data/*.json; the checks here only guard structure.
-- owner_id is a client-generated profile id until real users exist (VTTER-53), then the auth user id.

create table emberreach.characters (
  id            uuid primary key,
  owner_id      text not null check (length(owner_id) between 1 and 64),
  rules_version text not null,

  -- Identity
  name          text not null check (length(name) between 1 and 80),
  player        text not null default '',
  level         smallint not null default 1 check (level >= 1),
  ancestry      text not null default '',
  calling       text not null default '',
  background    text not null default '',
  oath          text not null default '',

  -- Attributes
  might         smallint not null default 0,
  grace         smallint not null default 0,
  wits          smallint not null default 0,
  lore          smallint not null default 0,
  spirit        smallint not null default 0,
  presence      smallint not null default 0,

  -- Current vitals (max Grit/Ember, Dodge, Will, Speed are derived in the app, not stored)
  grit          integer not null default 0 check (grit >= 0),
  ember         integer not null default 0 check (ember >= 0),
  death_fails   smallint not null default 0 check (death_fails >= 0),

  -- Features
  signature     text not null default '',

  -- Gear
  armor         text not null default 'none',
  shield        boolean not null default false,
  silver        integer not null default 0 check (silver >= 0),
  supply_die    text not null default 'd8',
  gear          text not null default '',

  -- Notes
  contacts      text not null default '',
  notes         text not null default '',
  portrait_path text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index characters_owner_idx on emberreach.characters (owner_id, updated_at desc);

create table emberreach.character_skills (
  character_id uuid not null references emberreach.characters (id) on delete cascade,
  skill        text not null,
  rank         smallint not null check (rank >= 0),
  primary key (character_id, skill)
);

create table emberreach.character_wounds (
  character_id uuid not null references emberreach.characters (id) on delete cascade,
  slot         smallint not null check (slot >= 1),
  attribute    text not null,
  primary key (character_id, slot)
);

create table emberreach.character_attacks (
  character_id uuid not null references emberreach.characters (id) on delete cascade,
  position     smallint not null,
  name         text not null,
  test_bonus   smallint not null default 0,
  damage       text not null default '',
  notes        text not null default '',
  primary key (character_id, position)
);

create table emberreach.character_talents (
  character_id uuid not null references emberreach.characters (id) on delete cascade,
  position     smallint not null,
  name         text not null,
  primary key (character_id, position)
);

create table emberreach.character_spells (
  character_id uuid not null references emberreach.characters (id) on delete cascade,
  position     smallint not null,
  name         text not null,
  ember        smallint not null default 0 check (ember >= 0),
  target       text not null default '',
  effect       text not null default '',
  primary key (character_id, position)
);
