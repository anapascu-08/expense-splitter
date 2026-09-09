import { describe, it, expect } from "vitest";
import {
  createGroup,
  updateGroup,
  updateMember,
  deleteGroup,
  addExpense,
  addMember as addMemberAction,
  addPayment,
  acceptInvite,
} from "@/app/actions";
import { prisma } from "@/lib/prisma";
import { makeUser, makeGroup, addMember, signIn, formData } from "@/test/factories";
import { catchRedirect, expectNotFound } from "@/test/next-navigation-errors";

describe("createGroup", () => {
  it("creates the group with the caller as owner member and redirects to it", async () => {
    const { user } = await makeUser();
    await signIn(user.id);

    const url = await catchRedirect(
      createGroup(undefined, formData({ name: "Trip" }))
    );
    const id = url.replace("/groups/", "");

    const group = await prisma.group.findUnique({
      where: { id },
      include: { groupMembers: true },
    });
    expect(group?.ownerId).toBe(user.id);
    expect(group?.groupMembers).toEqual([
      expect.objectContaining({ userId: user.id, role: "owner" }),
    ]);
  });

  it("returns an error for a blank name and creates nothing", async () => {
    const { user } = await makeUser();
    await signIn(user.id);

    const state = await createGroup(undefined, formData({ name: "  " }));

    expect(state).toEqual({ error: "Dă un nume grupului.", field: "name" });
    expect(await prisma.group.count()).toBe(0);
  });
});

describe("deleteGroup", () => {
  it("removes a group that has expenses and payments referencing its members", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const a = await prisma.member.create({
      data: { groupId: group.id, name: "A" },
    });
    const b = await prisma.member.create({
      data: { groupId: group.id, name: "B" },
    });
    await prisma.expense.create({
      data: {
        groupId: group.id,
        description: "x",
        amount: 1000,
        paidById: a.id,
        splitMode: "EQUAL",
        participants: {
          create: [
            { memberId: a.id, weight: 1 },
            { memberId: b.id, weight: 1 },
          ],
        },
      },
    });
    await prisma.payment.create({
      data: { groupId: group.id, amount: 500, fromId: b.id, toId: a.id },
    });

    const url = await catchRedirect(deleteGroup(group.id));

    expect(url).toBe("/");
    expect(await prisma.group.count({ where: { id: group.id } })).toBe(0);
    expect(await prisma.expense.count({ where: { groupId: group.id } })).toBe(0);
    expect(await prisma.payment.count({ where: { groupId: group.id } })).toBe(0);
    expect(await prisma.member.count({ where: { groupId: group.id } })).toBe(0);
  });

  it("is a no-op for a non-owner member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const member = await makeUser();
    await addMember(group.id, member.user.id);
    await signIn(member.user.id);

    await deleteGroup(group.id);

    expect(await prisma.group.count({ where: { id: group.id } })).toBe(1);
  });
});

describe("form-level validation feedback", () => {
  it("addMember rejects a duplicate name, accepts a new one", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    await prisma.member.create({ data: { groupId: group.id, name: "Alice" } });

    const dup = await addMemberAction(
      undefined,
      formData({ name: "Alice", groupId: group.id })
    );
    expect(dup).toEqual({
      error: '„Alice” există deja în grup.',
      field: "name",
    });

    // case-insensitive: "alice" must clash with the existing "Alice"
    const dupCase = await addMemberAction(
      undefined,
      formData({ name: "alice", groupId: group.id })
    );
    expect(dupCase).toEqual({
      error: '„alice” există deja în grup.',
      field: "name",
    });

    const ok = await addMemberAction(
      undefined,
      formData({ name: "Bob", groupId: group.id })
    );
    expect(ok).toEqual({ ok: "„Bob” a fost adăugat." });
    expect(await prisma.member.count({ where: { groupId: group.id } })).toBe(2);
  });

  it("addExpense reports the first invalid field", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);

    const state = await addExpense(
      undefined,
      formData({ description: "", amount: "10", groupId: group.id })
    );
    expect(state).toEqual({
      error: "Adaugă o descriere.",
      field: "description",
    });
    expect(await prisma.expense.count()).toBe(0);
  });

  it("addPayment flags both fromId and toId when they're the same member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const a = await prisma.member.create({
      data: { groupId: group.id, name: "A" },
    });

    const state = await addPayment(
      undefined,
      formData({ fromId: a.id, toId: a.id, amount: "10", groupId: group.id })
    );

    expect(state).toEqual({
      error: "Plătitorul și beneficiarul trebuie să fie diferiți.",
      field: ["fromId", "toId"],
    });
    expect(await prisma.payment.count()).toBe(0);
  });

  it("addExpense dedupes repeated participantIds instead of crashing on the PK", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const a = await prisma.member.create({
      data: { groupId: group.id, name: "A" },
    });

    const state = await addExpense(
      undefined,
      formData({
        description: "x",
        amount: "10",
        paidById: a.id,
        splitMode: "EQUAL",
        participantIds: [a.id, a.id],
        groupId: group.id,
      })
    );

    expect(state).toEqual({ ok: "Cheltuială adăugată." });
    const expense = await prisma.expense.findFirstOrThrow({
      where: { groupId: group.id },
      include: { participants: true },
    });
    expect(expense.participants).toHaveLength(1);
  });

  it("addExpense rejects a payer that is not a member of the group", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const other = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const inGroup = await prisma.member.create({
      data: { groupId: group.id, name: "A" },
    });
    const foreign = await prisma.member.create({
      data: { groupId: other.id, name: "B" },
    });

    const state = await addExpense(
      undefined,
      formData({
        description: "x",
        amount: "10",
        paidById: foreign.id,
        splitMode: "EQUAL",
        participantIds: [inGroup.id],
        groupId: group.id,
      })
    );

    expect(state).toEqual({
      error: "Unii membri nu mai fac parte din grup. Reîncarcă pagina.",
    });
    expect(await prisma.expense.count()).toBe(0);
  });

  it("addExpense rejects a participant that is not a member of the group", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const other = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const payer = await prisma.member.create({
      data: { groupId: group.id, name: "A" },
    });
    const foreign = await prisma.member.create({
      data: { groupId: other.id, name: "B" },
    });

    const state = await addExpense(
      undefined,
      formData({
        description: "x",
        amount: "10",
        paidById: payer.id,
        splitMode: "EQUAL",
        participantIds: [payer.id, foreign.id],
        groupId: group.id,
      })
    );

    expect(state).toEqual({
      error: "Unii membri nu mai fac parte din grup. Reîncarcă pagina.",
    });
    expect(await prisma.expense.count()).toBe(0);
  });

  it("addExpense gives a specific message when percentages miss 100%", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const a = await prisma.member.create({
      data: { groupId: group.id, name: "A" },
    });
    const b = await prisma.member.create({
      data: { groupId: group.id, name: "B" },
    });

    const state = await addExpense(
      undefined,
      formData({
        description: "x",
        amount: "100",
        paidById: a.id,
        splitMode: "PERCENT",
        participantIds: [a.id, b.id],
        [`weight_${a.id}`]: "40",
        [`weight_${b.id}`]: "40",
        groupId: group.id,
      })
    );

    expect(state).toEqual({
      error: "Procentele trebuie să adune fix 100%.",
    });
  });

  it("addExpense gives a specific message when there are no participants", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const a = await prisma.member.create({
      data: { groupId: group.id, name: "A" },
    });

    const state = await addExpense(
      undefined,
      formData({
        description: "x",
        amount: "10",
        paidById: a.id,
        splitMode: "EQUAL",
        groupId: group.id,
      })
    );

    expect(state).toEqual({ error: "Alege cel puțin un participant." });
  });

  it("addPayment flags amount for a zero amount", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const a = await prisma.member.create({
      data: { groupId: group.id, name: "A" },
    });
    const b = await prisma.member.create({
      data: { groupId: group.id, name: "B" },
    });

    const state = await addPayment(
      undefined,
      formData({ fromId: a.id, toId: b.id, amount: "0", groupId: group.id })
    );

    expect(state).toEqual({
      error: "Suma trebuie să fie mai mare ca zero.",
      field: "amount",
    });
  });
});

describe("updateGroup", () => {
  it("is a no-op for a non-owner member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id, { name: "Original" });
    const member = await makeUser();
    await addMember(group.id, member.user.id);
    await signIn(member.user.id);

    const state = await updateGroup(
      undefined,
      formData({ name: "Hijacked", groupId: group.id })
    );

    expect(state).toEqual({ error: "Doar owner-ul poate redenumi grupul." });
    const after = await prisma.group.findUnique({ where: { id: group.id } });
    expect(after?.name).toBe("Original");
  });

  it("renames the group for the owner and returns a success note", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id, { name: "Original" });
    await signIn(owner.user.id);

    const state = await updateGroup(
      undefined,
      formData({ name: "Renamed", groupId: group.id })
    );
    expect(state).toEqual({ ok: "Numele grupului a fost salvat." });
    const after = await prisma.group.findUnique({ where: { id: group.id } });
    expect(after?.name).toBe("Renamed");
  });
});

describe("updateMember", () => {
  it("renames a member and returns a success note (no redirect)", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const m = await prisma.member.create({
      data: { groupId: group.id, name: "Bob" },
    });

    const state = await updateMember(
      undefined,
      formData({ name: "Bobby", groupId: group.id, memberId: m.id })
    );
    expect(state).toEqual({ ok: "Numele membrului a fost salvat." });
    const after = await prisma.member.findUniqueOrThrow({ where: { id: m.id } });
    expect(after.name).toBe("Bobby");
  });

  it("rejects a name that clashes with another member (case-insensitive)", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    await prisma.member.create({ data: { groupId: group.id, name: "Ana" } });
    const m = await prisma.member.create({
      data: { groupId: group.id, name: "Bob" },
    });

    const state = await updateMember(
      undefined,
      formData({ name: "ana", groupId: group.id, memberId: m.id })
    );
    expect(state).toEqual({
      error: '„ana” există deja în grup.',
      field: "name",
    });
  });

  it("404s when the caller is not a member of the group", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const m = await prisma.member.create({
      data: { groupId: group.id, name: "Bob" },
    });
    const outsider = await makeUser();
    await signIn(outsider.user.id);

    await expectNotFound(
      updateMember(
        undefined,
        formData({ name: "X", groupId: group.id, memberId: m.id })
      )
    );
  });
});

describe("addExpense", () => {
  it("404s when the caller is not a group member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const outsider = await makeUser();
    await signIn(outsider.user.id);

    await expectNotFound(
      addExpense(
        undefined,
        formData({ description: "x", amount: "10", groupId: group.id })
      )
    );
    expect(await prisma.expense.count()).toBe(0);
  });

  it("creates an expense with participants for a member", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const alice = await prisma.member.create({
      data: { groupId: group.id, name: "Alice" },
    });

    await addExpense(
      undefined,
      formData({
        description: "Lunch",
        amount: "100",
        paidById: alice.id,
        splitMode: "EQUAL",
        participantIds: [alice.id],
        groupId: group.id,
      })
    );

    const expense = await prisma.expense.findFirst({
      where: { groupId: group.id },
      include: { participants: true },
    });
    expect(expense?.description).toBe("Lunch");
    expect(expense?.amount).toBe(10000);
    expect(expense?.participants).toHaveLength(1);
  });
});

describe("acceptInvite", () => {
  async function makeInvite(overrides?: {
    expiresAt?: Date;
    revokedAt?: Date | null;
  }) {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const invite = await prisma.groupInvite.create({
      data: {
        groupId: group.id,
        createdById: owner.user.id,
        expiresAt: overrides?.expiresAt ?? new Date(Date.now() + 86_400_000),
        revokedAt: overrides?.revokedAt ?? null,
      },
    });
    return { group, invite };
  }

  it("adds the caller as a member and redirects to the group", async () => {
    const { group, invite } = await makeInvite();
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    const url = await catchRedirect(acceptInvite(invite.token));
    expect(url).toBe(`/groups/${group.id}`);

    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: joiner.user.id } },
    });
    expect(membership?.role).toBe("member");
  });

  it("does nothing for an expired invite", async () => {
    const { group, invite } = await makeInvite({
      expiresAt: new Date(Date.now() - 1000),
    });
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    await acceptInvite(invite.token); // no redirect thrown
    expect(
      await prisma.groupMember.count({
        where: { groupId: group.id, userId: joiner.user.id },
      })
    ).toBe(0);
  });

  it("does nothing for a revoked invite", async () => {
    const { group, invite } = await makeInvite({ revokedAt: new Date() });
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    await acceptInvite(invite.token);
    expect(
      await prisma.groupMember.count({
        where: { groupId: group.id, userId: joiner.user.id },
      })
    ).toBe(0);
  });
});
