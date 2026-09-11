# Location Schema

Geographic taxonomy for WorkIndia. Used later by jobs, candidate preferred locations, company sites, and SEO location pages.

## Hierarchy

Exactly four levels:

```
country
  └── state
        └── city
              └── area
```

| Type | Parent | `parentId` |
|------|--------|------------|
| `country` | — | `null` |
| `state` | `country` | required |
| `city` | `state` | required |
| `area` | `city` | required |

Invalid parent/type combinations are rejected (`409`). Self-parent and circular chains are rejected.

## Fields

| Field | Notes |
|-------|--------|
| `name` | Display name (2–120 chars) |
| `slug` | Globally unique public URL key; stable on rename |
| `type` | `country` \| `state` \| `city` \| `area` |
| `parentId` | Immediate parent; `null` for countries |
| `countryCode` | Optional ISO-style code (e.g. `IN`) |
| `stateCode` | Optional regional code (e.g. `MH`) |
| `latitude` / `longitude` | Optional; lat −90…90, lng −180…180 |
| `status` | `active` \| `inactive` |
| `createdAt` / `updatedAt` | Timestamps |

## Uniqueness

- **Slug:** unique across all locations (public URLs).
- **Name under parent:** unique per parent (case-insensitive in service; compound index `{ parentId, name }`). Same city name under different states is allowed.

## Indexes

- unique `{ slug }`
- unique `{ parentId, name }`
- `{ parentId, type, status }`
- `{ type, status }`
- `{ countryCode, stateCode }`
- `{ name, type }`

## Public vs admin

- **Public** endpoints return only `active` locations.
- **Admin** can list/manage `active` and `inactive`.
- Unsafe deletes (children or jobs referencing `location.locationId`) deactivate instead of hard-delete.

## Future references

- `Job.location.locationId`
- Candidate preferred locations (currently string list; may migrate to Location ids later)
- Company location strings may later resolve to Location documents

Do not implement job/candidate/company location wiring in B10.
