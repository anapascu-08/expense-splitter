import { describe, it, expect } from "vitest";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  addExpense,
  addMember as addMemberAction,
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

    expect(state).toEqual({ error: "Dă un nume grupului." });
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
      group.id,
      undefined,
      formData({ name: "Alice" })
    );
    expect(dup).toEqual({ error: '„Alice” există deja în grup.' });

    const ok = await addMemberAction(
      group.id,
      undefined,
      formData({ name: "Bob" })
    );
    expect(ok).toEqual({ ok: "„Bob” a fost adăugat." });
    expect(await prisma.member.count({ where: { groupId: group.id } })).toBe(2);
  });

  it("addExpense reports the first invalid field", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id);
    await signIn(owner.user.id);

    const state = await addExpense(
      group.id,
      undefined,
      formData({ description: "", amount: "10" })
    );
    expect(state).toEqual({ error: "Adaugă o descriere." });
    expect(await prisma.expense.count()).toBe(0);
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
      group.id,
      undefined,
      formData({ name: "Hijacked" })
    );

    expect(state).toEqual({ error: "Doar owner-ul poate redenumi grupul." });
    const after = await prisma.group.findUnique({ where: { id: group.id } });
    expect(after?.name).toBe("Original");
  });

  it("renames the group for the owner and redirects", async () => {
    const owner = await makeUser();
    const group = await makeGroup(owner.user.id, { name: "Original" });
    await signIn(owner.user.id);

    const url = await catchRedirect(
      updateGroup(group.id, undefined, formData({ name: "Renamed" }))
    );
    expect(url).toBe(`/groups/${group.id}`);
    const after = await prisma.group.findUnique({ where: { id: group.id } });
    expect(after?.name).toBe("Renamed");
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
        group.id,
        undefined,
        formData({ description: "x", amount: "10" })
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
      group.id,
      undefined,
      formData({
        description: "Lunch",
        amount: "100",
        paidById: alice.id,
        splitMode: "EQUAL",
        participantIds: [alice.id],
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
