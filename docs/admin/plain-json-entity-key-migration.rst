Plain JSON Entity Key Migration
================================

Background
----------

Pontoon commit ``d12b31d15`` ("Harmonize Entity & Resource.Format representation
with moz.l10n", August 2025) renamed the ``json`` resource format to
``plain_json`` and changed how entity keys are stored.

**Old format** (before ``d12b31d15``): ``plain_json_as_entity`` used
``key=dumps(entry.id)`` — i.e. the key was stored as a JSON-serialised string.
For a top-level key ``active``, the entity key was stored as ``'["active"]'``.

**Migration** ``0091_set_entity_new_key`` converted the old ``TextField`` key
into an ``ArrayField`` by splitting on ``\x04``. For plain_json entities there
is no ``\x04``, so ``'["active"]'`` became ``['["active"]']`` — a one-element
list still containing the JSON-encoded string.

**New format** (after ``d12b31d15``): sync creates entities with
``key=list(entry.id)``, e.g. ``['active']`` — a plain string list.

The consequence is that on the next sync after the migration was applied:

1. Existing entities (key ``['["active"]']``) did not match the new entities
   the sync tried to create (key ``['active']``).
2. All old entities were marked **obsolete** and new ones were created.
3. All translations stayed attached to the now-obsolete entities.
4. ``sync_translations_to_repo`` filters on ``entity__obsolete=False``, so it
   found zero translations and wrote ``{}`` to every locale file in the repo.

Affected projects
-----------------

Any project using the ``plain_json`` resource format that was synced after
commit ``d12b31d15`` but before a manual migration was applied.

Symptoms
~~~~~~~~

* Locale translation files in the repository contain ``{}`` (empty JSON).
* The Pontoon UI still shows translation counts > 0 (they exist in the DB on
  obsolete entities).
* Running ``sync_project`` produces ``(False, False)`` with no "Reading changes"
  log lines.

Detection
---------

Run the **check script** (see ``scripts/check_plain_json_entity_keys.py``) to
identify affected resources. A resource is affected when it has ``plain_json``
format entities whose key starts with ``["`` (i.e. the JSON-encoded array
string is still wrapped in the ArrayField).

.. code-block:: bash

   kubectl exec deployments/pontoon -- python scripts/check_plain_json_entity_keys.py

Fix
---

Run the **migration script** (see ``scripts/migrate_plain_json_entity_keys.py``)
for each affected project. The script:

1. Decodes each old-style entity key from ``['["active"]']`` → ``['active']``
   using ``json.loads``.
2. Finds the matching current (non-obsolete) entity.
3. Reassigns all translations from the obsolete entity to the current one.
4. Recalculates ``TranslatedResource`` stats.

The script is safe to run multiple times (it will find zero translations to move
on a second run). It does **not** delete any entities or translations.

.. code-block:: bash

   # Dry run (read-only, no DB changes)
   kubectl exec deployments/pontoon -- python scripts/migrate_plain_json_entity_keys.py --dry-run

   # Run for a single project first
   kubectl exec deployments/pontoon -- python scripts/migrate_plain_json_entity_keys.py --project stc-configurator

   # Run for all affected projects
   kubectl exec deployments/pontoon -- python scripts/migrate_plain_json_entity_keys.py

After migration
---------------

The migration moves translations to current entities. The next ``sync_project``
run will then detect the translations (via ``ChangedEntityLocale`` entries or a
forced sync) and write them back to the repository files.

If the sync does not trigger automatically, you can force it via the Pontoon
admin UI (Project → Sync) or by running:

.. code-block:: bash

   kubectl exec deployments/pontoon -- python manage.py sync_projects --projects stc-configurator

Root cause in code
------------------

``pontoon/base/migrations/0091_set_entity_new_key.py``::

    key = entity.old_key.split("\x04")

For ``plain_json`` resources the old key was already a JSON array string
(``'["active"]'``). Splitting on ``\x04`` leaves it unchanged, producing
``['["active"]']`` instead of the correct ``['active']``.

A corrected version of the migration would need a ``json.loads`` step for
``plain_json`` format entities, similar to how ``gettext`` entities have
their key reversed in that same migration.

Debugging session notes
-----------------------

Discovered during investigation of stc-configurator sync not importing
translations (April 2026). Key findings:

* ``git show 7d20ffe`` showed Pontoon's last commit had replaced all locale
  JSON files (295 lines each) with a single ``{}`` line.
* DB had 304 approved German translations, 293 Dutch, French, Spanish; all
  attached to obsolete entities.
* 14 ``plain_json`` projects were affected in total (1,789 old-style entities,
  15,980 translations).
* ``stc-configurator`` was fully migrated (1,274 translations reassigned).
  All other projects had already been re-translated via the UI by the time
  the migration ran, so they were in a ``PARTIAL`` state with no data loss.
