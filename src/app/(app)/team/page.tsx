import { savePositionTemplateAction, addGuardianAction, addStaffRoleAction, createPlayerAction } from "@/actions/team-actions";
import { SubmitButton } from "@/components/submit-button";
import { canManagePrivateContacts, canManageTeam } from "@/lib/authz";
import { getTeamPageData, getViewerContext } from "@/lib/data";

export default async function TeamPage() {
  const viewer = await getViewerContext();

  if (!viewer) {
    return null;
  }

  const data = await getTeamPageData(viewer);

  return (
    <div className="page-grid">
      <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow">Roster</div>
            <h2 className="mt-2 text-3xl text-[var(--navy-strong)]">Team directory</h2>
            <p className="mt-2 max-w-2xl text-base leading-7 text-[color-mix(in_srgb,var(--navy)_74%,white)]">
              Parents see the roster and team structure. Coaches and admins can
              manage invitations and private contact details.
            </p>
          </div>
          <div className="stat-pill text-sm font-semibold text-[var(--navy-strong)]">
            {data.players.length} players · {data.staff.length} adults
          </div>
        </div>
      </section>

      {canManageTeam(viewer) ? (
        <section className="grid gap-6 xl:grid-cols-3">
          <form action={createPlayerAction} className="shell-panel rounded-[2rem] p-5">
            <div className="mb-4">
              <div className="eyebrow">Add player</div>
              <h3 className="mt-2 text-xl text-[var(--navy-strong)]">Roster a player</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="firstName">First name</label>
                <input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName">Last name</label>
                <input id="lastName" name="lastName" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="preferredName">Preferred name</label>
                <input id="preferredName" name="preferredName" />
              </div>
              <div className="space-y-2">
                <label htmlFor="jerseyNumber">Jersey</label>
                <input id="jerseyNumber" name="jerseyNumber" type="number" min="0" max="99" />
              </div>
              <div className="space-y-2">
                <label htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" placeholder="Anything coaches should remember when planning." />
              </div>
              <SubmitButton label="Add player" />
            </div>
          </form>

          <form action={addGuardianAction} className="shell-panel rounded-[2rem] p-5">
            <div className="mb-4">
              <div className="eyebrow">Add guardian</div>
              <h3 className="mt-2 text-xl text-[var(--navy-strong)]">Link a family account</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="playerId">Player</label>
                <select id="playerId" name="playerId" required>
                  <option value="">Select a player</option>
                  {data.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="guardianName">Guardian name</label>
                <input id="guardianName" name="name" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="guardianEmail">Guardian email</label>
                <input id="guardianEmail" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="guardianPhone">Phone</label>
                <input id="guardianPhone" name="phone" />
              </div>
              <div className="space-y-2">
                <label htmlFor="relationshipLabel">Relationship</label>
                <input id="relationshipLabel" name="relationshipLabel" defaultValue="Guardian" />
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium">
                <input type="checkbox" name="sendInvite" className="h-4 w-4" />
                Send an invitation email now
              </label>
              <SubmitButton label="Link guardian" />
            </div>
          </form>

          <form action={addStaffRoleAction} className="shell-panel rounded-[2rem] p-5">
            <div className="mb-4">
              <div className="eyebrow">Add staff</div>
              <h3 className="mt-2 text-xl text-[var(--navy-strong)]">Coach or admin</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="staffName">Name</label>
                <input id="staffName" name="name" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="staffEmail">Email</label>
                <input id="staffEmail" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <label htmlFor="staffPhone">Phone</label>
                <input id="staffPhone" name="phone" />
              </div>
              <div className="space-y-2">
                <label htmlFor="role">Role</label>
                <select id="role" name="role" defaultValue="COACH">
                  <option value="COACH">Coach</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium">
                <input type="checkbox" name="sendInvite" className="h-4 w-4" />
                Send an invitation email now
              </label>
              <SubmitButton label="Add staff role" />
            </div>
          </form>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
          <div className="mb-5">
            <div className="eyebrow">Players and guardians</div>
            <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">Roster cards</h3>
          </div>
          <div className="grid gap-4">
            {data.players.map((player) => (
              <article
                key={player.id}
                className="rounded-[1.75rem] border border-[var(--line)] bg-white/80 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-2xl text-[var(--navy-strong)]">
                      {player.displayName}
                    </h4>
                    <div className="mt-2 text-sm text-[color-mix(in_srgb,var(--navy)_70%,white)]">
                      Jersey {player.jerseyNumber ?? "TBD"}
                    </div>
                    {player.notes ? (
                      <p className="mt-3 text-sm leading-6 text-[color-mix(in_srgb,var(--navy)_72%,white)]">
                        {player.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="stat-pill text-xs font-semibold text-[var(--navy-strong)]">
                    {player.guardians.length}/2 guardians
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {player.guardians.map((guardian) => (
                    <div
                      key={guardian.userId}
                      className="rounded-[1.25rem] border border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_86%,white)] px-4 py-3"
                    >
                      <div className="font-semibold text-[var(--navy-strong)]">
                        {guardian.name || guardian.email}
                      </div>
                      <div className="text-sm text-[color-mix(in_srgb,var(--navy)_68%,white)]">
                        {guardian.relationshipLabel}
                      </div>
                      {canManagePrivateContacts(viewer) ? (
                        <div className="mt-2 space-y-1 text-sm text-[color-mix(in_srgb,var(--navy)_72%,white)]">
                          <div>{guardian.email}</div>
                          {guardian.phone ? <div>{guardian.phone}</div> : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="page-grid">
          <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
            <div className="mb-5">
              <div className="eyebrow">Staff contacts</div>
              <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">Coaches and admins</h3>
            </div>
            <div className="space-y-3">
              {data.staff.map((staffer) => (
                <div
                  key={staffer.userId}
                  className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 p-4"
                >
                  <div className="text-lg font-semibold text-[var(--navy-strong)]">
                    {staffer.name || staffer.email}
                  </div>
                  <div className="text-sm text-[color-mix(in_srgb,var(--navy)_68%,white)]">
                    {staffer.roleLabel}
                  </div>
                  {canManagePrivateContacts(viewer) ? (
                    <div className="mt-2 space-y-1 text-sm text-[color-mix(in_srgb,var(--navy)_72%,white)]">
                      <div>{staffer.email}</div>
                      {staffer.phone ? <div>{staffer.phone}</div> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {canManageTeam(viewer) ? (
            <section className="shell-panel rounded-[2.25rem] p-6 sm:p-8">
              <div className="mb-5">
                <div className="eyebrow">Defensive positions</div>
                <h3 className="mt-2 text-2xl text-[var(--navy-strong)]">Lineup position template</h3>
              </div>
              <div className="space-y-3">
                {data.positions.map((position) => (
                  <div
                    key={position.id}
                    className="rounded-[1.5rem] border border-[var(--line)] bg-white/75 px-4 py-3 text-sm text-[var(--navy-strong)]"
                  >
                    {position.code} · {position.label}
                  </div>
                ))}
              </div>
              <form action={savePositionTemplateAction} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="code">Code</label>
                  <input id="code" name="code" placeholder="LF" required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="label">Label</label>
                  <input id="label" name="label" placeholder="Left Field" required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="sortOrder">Sort order</label>
                  <input id="sortOrder" name="sortOrder" type="number" defaultValue="120" />
                </div>
                <label className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-medium">
                  <input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" />
                  Active in lineup planner
                </label>
                <SubmitButton label="Save position" />
              </form>
            </section>
          ) : null}
        </div>
      </section>
    </div>
  );
}

