import { describe, it, expect } from "vitest";
import {
  createGroup,
  updateGroup,
  updateMember,
  deleteGroup,
  addExpense,
  updateExpense,
  deleteExpense,
  addMember as addMemberAction,
  addPayment,
  deletePayment,
  deleteMember,
  unlinkMember,
  archiveMember,
  unarchiveMember,
  createInvite,
  revokeInvite,
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

  it("addExpense requires a split mode to be chosen", async () => {
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
        participantIds: [a.id],
        groupId: group.id,
      })
    );

    expect(state).toEqual({
      error: "Alege cum se împarte cheltuiala.",
      field: "splitMode",
    });
    expect(await prisma.expense.count()).toBe(0);
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

describe("unlinkMember", () => {
  async function claimedSetup() {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const joiner = await makeUser({ name: "Joiner" });
    await addMember(group.id, joiner.user.id); // group access
    const slot = await prisma.member.create({
      data: { groupId: group.id, name: "Dana", userId: joiner.user.id },
    });
    return { owner, group, joiner, slot };
  }

  it("owner unlinks a claimed slot: userId cleared, slot kept, account loses access", async () => {
    const { owner, group, joiner, slot } = await claimedSetup();
    await signIn(owner.user.id);

    await unlinkMember(group.id, slot.id);

    const after = await prisma.member.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(after.userId).toBeNull();
    expect(after.name).toBe("Dana");
    expect(
      await prisma.groupMember.findUnique({
        where: {
          groupId_userId: { groupId: group.id, userId: joiner.user.id },
        },
      })
    ).toBeNull();
  });

  it("does nothing when a non-owner calls it", async () => {
    const { group, joiner, slot } = await claimedSetup();
    await signIn(joiner.user.id);

    await unlinkMember(group.id, slot.id);

    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: slot.id } })).userId
    ).toBe(joiner.user.id);
  });

  it("is a no-op on an already-unclaimed slot", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const slot = await prisma.member.create({
      data: { groupId: group.id, name: "Free" },
    });
    await signIn(owner.user.id);

    await unlinkMember(group.id, slot.id);

    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: slot.id } })).userId
    ).toBeNull();
  });

  it("refuses to unlink the owner's own slot", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const slot = await prisma.member.create({
      data: { groupId: group.id, name: "Owner", userId: owner.user.id },
    });
    await signIn(owner.user.id);

    await unlinkMember(group.id, slot.id);

    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: slot.id } })).userId
    ).toBe(owner.user.id);
    expect(
      await prisma.groupMember.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: owner.user.id } },
      })
    ).not.toBeNull();
  });

  it("won't touch a slot that belongs to another group", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const other = await makeGroup(owner.user.id);
    const outsider = await makeUser();
    const slot = await prisma.member.create({
      data: { groupId: other.id, name: "Elsewhere", userId: outsider.user.id },
    });
    await signIn(owner.user.id);

    await unlinkMember(group.id, slot.id);

    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: slot.id } })).userId
    ).toBe(outsider.user.id);
  });

  it("lets the ex-claimer re-accept the invite and claim again", async () => {
    const { owner, group, joiner, slot } = await claimedSetup();
    const invite = await prisma.groupInvite.create({
      data: {
        groupId: group.id,
        createdById: owner.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await signIn(owner.user.id);
    await unlinkMember(group.id, slot.id);

    await signIn(joiner.user.id);
    await catchRedirect(
      acceptInvite(invite.token, formData({ claimMemberId: slot.id }))
    );

    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: slot.id } })).userId
    ).toBe(joiner.user.id);
    expect(
      await prisma.member.count({
        where: { groupId: group.id, userId: joiner.user.id },
      })
    ).toBe(1);
  });
});

describe("archiveMember / unarchiveMember", () => {
  async function owedPair() {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);
    const ana = await prisma.member.create({
      data: { groupId: group.id, name: "Ana" },
    });
    const bob = await prisma.member.create({
      data: { groupId: group.id, name: "Bob" },
    });
    // Ana pays 100, split equally -> Bob owes Ana 50.
    await addExpense(
      undefined,
      formData({
        description: "Cazare",
        amount: "100",
        paidById: ana.id,
        splitMode: "EQUAL",
        participantIds: [ana.id, bob.id],
        groupId: group.id,
      })
    );
    return { owner, group, ana, bob };
  }

  const archivedAt = async (id: string) =>
    (await prisma.member.findUniqueOrThrow({ where: { id } })).archivedAt;

  it("archives a member once their balance is settled", async () => {
    const { group, ana, bob } = await owedPair();
    await addPayment(
      undefined,
      formData({ fromId: bob.id, toId: ana.id, amount: "50", groupId: group.id })
    );

    await archiveMember(group.id, bob.id);

    expect(await archivedAt(bob.id)).not.toBeNull();
  });

  it("refuses to archive a member with a non-zero balance", async () => {
    const { group, bob } = await owedPair();

    await archiveMember(group.id, bob.id);

    expect(await archivedAt(bob.id)).toBeNull();
  });

  it("does nothing when a non-owner calls archive", async () => {
    const { group, ana, bob } = await owedPair();
    await addPayment(
      undefined,
      formData({ fromId: bob.id, toId: ana.id, amount: "50", groupId: group.id })
    );
    const outsider = await makeUser();
    await addMember(group.id, outsider.user.id);
    await signIn(outsider.user.id);

    await archiveMember(group.id, bob.id);

    expect(await archivedAt(bob.id)).toBeNull();
  });

  it("unarchives a member (owner only)", async () => {
    const { owner, group, bob } = await owedPair();
    await prisma.member.update({
      where: { id: bob.id },
      data: { archivedAt: new Date() },
    });

    const outsider = await makeUser();
    await addMember(group.id, outsider.user.id);
    await signIn(outsider.user.id);
    await unarchiveMember(group.id, bob.id);
    expect(await archivedAt(bob.id)).not.toBeNull();

    await signIn(owner.user.id);
    await unarchiveMember(group.id, bob.id);
    expect(await archivedAt(bob.id)).toBeNull();
  });

  it("keeps a new expense from naming an archived member", async () => {
    const { group, ana, bob } = await owedPair();
    await addPayment(
      undefined,
      formData({ fromId: bob.id, toId: ana.id, amount: "50", groupId: group.id })
    );
    await archiveMember(group.id, bob.id);

    const state = await addExpense(
      undefined,
      formData({
        description: "Cina",
        amount: "20",
        paidById: ana.id,
        splitMode: "EQUAL",
        participantIds: [ana.id, bob.id],
        groupId: group.id,
      })
    );

    expect(state).toEqual({
      error: "Unii membri nu mai fac parte din grup. Reîncarcă pagina.",
    });
    expect(await prisma.expense.count({ where: { groupId: group.id } })).toBe(1);
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

describe("permissions: member vs owner", () => {
  async function setup() {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    const memberUser = await makeUser();
    await addMember(group.id, memberUser.user.id); // role "member"
    const a = await prisma.member.create({
      data: { groupId: group.id, name: "A" },
    });
    const b = await prisma.member.create({
      data: { groupId: group.id, name: "B" },
    });
    return { owner, group, memberUser, a, b };
  }

  function expenseForm(groupId: string, paidById: string, participantId: string) {
    return formData({
      description: "x",
      amount: "10",
      paidById,
      splitMode: "EQUAL",
      participantIds: [participantId],
      groupId,
    });
  }

  it("a member can delete an expense they added", async () => {
    const { group, memberUser, a } = await setup();
    await signIn(memberUser.user.id);
    await addExpense(undefined, expenseForm(group.id, a.id, a.id));
    const exp = await prisma.expense.findFirstOrThrow({
      where: { groupId: group.id },
    });

    await deleteExpense(group.id, exp.id);

    expect(await prisma.expense.count({ where: { groupId: group.id } })).toBe(0);
  });

  it("a member cannot delete an expense someone else added", async () => {
    const { owner, group, memberUser, a } = await setup();
    await signIn(owner.user.id);
    await addExpense(undefined, expenseForm(group.id, a.id, a.id));
    const exp = await prisma.expense.findFirstOrThrow({
      where: { groupId: group.id },
    });

    await signIn(memberUser.user.id);
    await deleteExpense(group.id, exp.id);

    expect(await prisma.expense.count({ where: { groupId: group.id } })).toBe(1);
  });

  it("the owner can delete an expense a member added", async () => {
    const { owner, group, memberUser, a } = await setup();
    await signIn(memberUser.user.id);
    await addExpense(undefined, expenseForm(group.id, a.id, a.id));
    const exp = await prisma.expense.findFirstOrThrow({
      where: { groupId: group.id },
    });

    await signIn(owner.user.id);
    await deleteExpense(group.id, exp.id);

    expect(await prisma.expense.count({ where: { groupId: group.id } })).toBe(0);
  });

  it("updateExpense refuses a member who did not add the expense", async () => {
    const { owner, group, memberUser, a } = await setup();
    await signIn(owner.user.id);
    await addExpense(undefined, expenseForm(group.id, a.id, a.id));
    const exp = await prisma.expense.findFirstOrThrow({
      where: { groupId: group.id },
    });

    await signIn(memberUser.user.id);
    const state = await updateExpense(
      group.id,
      exp.id,
      undefined,
      expenseForm(group.id, a.id, a.id)
    );

    expect(state).toEqual({
      error: "Doar cine a adăugat cheltuiala sau owner-ul o pot edita.",
    });
  });

  it("a member cannot delete a payment someone else recorded", async () => {
    const { owner, group, memberUser, a, b } = await setup();
    await signIn(owner.user.id);
    await addPayment(
      undefined,
      formData({ fromId: a.id, toId: b.id, amount: "5", groupId: group.id })
    );
    const pay = await prisma.payment.findFirstOrThrow({
      where: { groupId: group.id },
    });

    await signIn(memberUser.user.id);
    await deletePayment(group.id, pay.id);

    expect(await prisma.payment.count({ where: { groupId: group.id } })).toBe(1);
  });

  it("only the owner can delete a member", async () => {
    const { group, memberUser, b } = await setup();
    await signIn(memberUser.user.id);

    await deleteMember(group.id, b.id);

    expect(await prisma.member.count({ where: { id: b.id } })).toBe(1);
  });

  it("reuses the existing invite link instead of minting a new token", async () => {
    const { owner, group } = await setup();
    await signIn(owner.user.id);

    await createInvite(group.id);
    const first = await prisma.groupInvite.findFirstOrThrow({
      where: { groupId: group.id },
    });

    // rewind its expiry so we can see the second call push it back out
    await prisma.groupInvite.update({
      where: { token: first.token },
      data: { expiresAt: new Date(Date.now() + 1_000) },
    });

    await createInvite(group.id);

    const all = await prisma.groupInvite.findMany({
      where: { groupId: group.id },
    });
    expect(all).toHaveLength(1);
    expect(all[0].token).toBe(first.token);
    expect(all[0].expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 6 * 24 * 60 * 60 * 1000
    );
  });

  it("mints a fresh token once the previous link is revoked", async () => {
    const { owner, group } = await setup();
    await signIn(owner.user.id);

    await createInvite(group.id);
    const first = await prisma.groupInvite.findFirstOrThrow({
      where: { groupId: group.id },
    });
    await revokeInvite(group.id, first.token);

    await createInvite(group.id);

    const active = await prisma.groupInvite.findMany({
      where: { groupId: group.id, revokedAt: null },
    });
    expect(active).toHaveLength(1);
    expect(active[0].token).not.toBe(first.token);
  });

  it("only the owner can create or revoke invites", async () => {
    const { owner, group, memberUser } = await setup();

    await signIn(memberUser.user.id);
    await createInvite(group.id);
    expect(await prisma.groupInvite.count({ where: { groupId: group.id } })).toBe(
      0
    );

    await signIn(owner.user.id);
    await createInvite(group.id);
    const invite = await prisma.groupInvite.findFirstOrThrow({
      where: { groupId: group.id },
    });

    await signIn(memberUser.user.id);
    await revokeInvite(group.id, invite.token);
    const after = await prisma.groupInvite.findUniqueOrThrow({
      where: { token: invite.token },
    });
    expect(after.revokedAt).toBeNull();
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

    // and gets a Member slot so they show up in the balances immediately
    const slots = await prisma.member.findMany({
      where: { groupId: group.id, userId: joiner.user.id },
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].name).toBe(joiner.user.name);
  });

  it("does not create a second Member slot on a repeat accept", async () => {
    const { group, invite } = await makeInvite();
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    await catchRedirect(acceptInvite(invite.token));
    await catchRedirect(acceptInvite(invite.token));

    expect(
      await prisma.member.count({
        where: { groupId: group.id, userId: joiner.user.id },
      })
    ).toBe(1);
  });

  it("claims an existing unclaimed Member slot when asked", async () => {
    const { group, invite } = await makeInvite();
    const slot = await prisma.member.create({
      data: { groupId: group.id, name: "Ana" },
    });
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    await catchRedirect(
      acceptInvite(invite.token, formData({ claimMemberId: slot.id }))
    );

    const claimed = await prisma.member.findUniqueOrThrow({
      where: { id: slot.id },
    });
    expect(claimed.userId).toBe(joiner.user.id);
    expect(claimed.name).toBe("Ana");
    // no extra slot was created
    expect(await prisma.member.count({ where: { groupId: group.id } })).toBe(1);
  });

  it("creates a fresh slot when the joiner picks 'new' despite open slots", async () => {
    const { group, invite } = await makeInvite();
    const slot = await prisma.member.create({
      data: { groupId: group.id, name: "Ana" },
    });
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    await catchRedirect(
      acceptInvite(invite.token, formData({ claimMemberId: "new" }))
    );

    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: slot.id } })).userId
    ).toBeNull();
    const own = await prisma.member.findMany({
      where: { groupId: group.id, userId: joiner.user.id },
    });
    expect(own).toHaveLength(1);
    expect(own[0].name).toBe(joiner.user.name);
  });

  it("falls back to a fresh slot when the chosen slot is already claimed", async () => {
    const { group, invite } = await makeInvite();
    const other = await makeUser();
    const slot = await prisma.member.create({
      data: { groupId: group.id, name: "Ana", userId: other.user.id },
    });
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    await catchRedirect(
      acceptInvite(invite.token, formData({ claimMemberId: slot.id }))
    );

    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: slot.id } })).userId
    ).toBe(other.user.id);
    const own = await prisma.member.findMany({
      where: { groupId: group.id, userId: joiner.user.id },
    });
    expect(own).toHaveLength(1);
    expect(own[0].id).not.toBe(slot.id);
  });

  it("won't claim a slot that belongs to another group", async () => {
    const { group, invite } = await makeInvite();
    const otherOwner = await makeUser();
    const otherGroup = await makeGroup(otherOwner.user.id);
    const foreignSlot = await prisma.member.create({
      data: { groupId: otherGroup.id, name: "Ana" },
    });
    const joiner = await makeUser();
    await signIn(joiner.user.id);

    await catchRedirect(
      acceptInvite(invite.token, formData({ claimMemberId: foreignSlot.id }))
    );

    expect(
      (await prisma.member.findUniqueOrThrow({ where: { id: foreignSlot.id } }))
        .userId
    ).toBeNull();
    expect(
      await prisma.member.count({
        where: { groupId: group.id, userId: joiner.user.id },
      })
    ).toBe(1);
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
