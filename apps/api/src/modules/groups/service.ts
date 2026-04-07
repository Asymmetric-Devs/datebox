import { SupabaseClient } from "@supabase/supabase-js";
import { ApiException } from "@/utils/api-error";
import { NewGroup, AddUserWithCode } from "./schema";
import { Database } from "@/supabase-types";

export class GroupService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Create a Group for the new User.
   */
  async create(newGroup: NewGroup) {
    const created = await this.createGroup(
      newGroup.ownerUserId,
      newGroup.name,
    );

    const { error: memberError } = await this.supabase
      .from("group_members")
      .insert({
        userId: newGroup.ownerUserId,
        groupId: created.id,
        role: "owner",
      });

    if (memberError) {
      console.error("Error creating group membership: ", memberError);
      throw new ApiException(500, "Error creating group membership");
    }

    return true;
  }

  async createInvitation(groupId: string) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 600 * 1000).toISOString();

    const { error } = await this.supabase
      .from("groups")
      .update({
        code: code,
        expiresAt: expiresAt,
      })
      .eq("id", groupId)
      .single();

    if (error) {
      console.error("Error finding the group: ", error);
      throw new ApiException(500, "Error finding the group");
    }

    return code;
  }

  async addUserToGroupWithCode(groupData: AddUserWithCode) {
    const dateNow = new Date();

    const { data, error } = await this.supabase
      .from("groups")
      .select("id, expiresAt")
      .eq("code", groupData.invitationCode)
      .single();

    if (error) {
      console.error("Error finding the group: ", error);
      throw new ApiException(500, "Error finding the group");
    }

    if (!data) {
      console.error("Couldn't find the group");
      throw new ApiException(404, "Group not found");
    }

    const dateExpiresAt = new Date(data.expiresAt ?? dateNow);

    if (dateExpiresAt < dateNow) {
      console.error("The invitation code has expired");
      throw new ApiException(400, "The invitation code has expired");
    }

    const { error: memberError } = await this.supabase
      .from("group_members")
      .insert({
        userId: groupData.userId,
        groupId: data.id,
        role: "member",
      });

    if (memberError) {
      if (memberError.code === "23505") {
        throw new ApiException(400, "User is already a member of this group");
      }
      console.error("Error linking the user with the group: ", memberError);
      throw new ApiException(500, "Error linking the user with the group");
    }

    return true;
  }

  async getMembers(groupId: string): Promise<{
    name: string;
    owner: { id: string; displayName: string; avatarUrl: string | null; elder: boolean; activeFrameUrl: string | null };
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      elder: boolean;
      activeFrameUrl: string | null;
    }>;
  }> {
    const { data: group, error: groupErr } = await this.supabase
      .from("groups")
      .select("name, ownerUserId")
      .eq("id", groupId)
      .single();

    if (groupErr || !group) {
      console.error("Error fetching group: ", groupErr);
      throw new ApiException(404, "Group not found");
    }

    const { data: members, error: membersErr } = await this.supabase
      .from("group_members")
      .select("users (id, displayName, avatarUrl, elder)")
      .eq("groupId", groupId);

    if (membersErr) {
      console.error("Error fetching group members: ", membersErr);
      throw new ApiException(500, "Error fetching group members");
    }

    const membersList = (members ?? []).map(m => m.users).filter(Boolean) as Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      elder: boolean;
    }>;
    const memberIds = membersList.map((m) => m.id);

    let framesMap: Record<string, string> = {};
    if (memberIds.length > 0) {
      const { data: frames } = await this.supabase
        .from("user_inventory")
        .select("user_id, item:shop_items(type, asset_url)")
        .in("user_id", memberIds)
        .eq("equipped", true)
        .eq("item.type", "frame");

      if (frames) {
        frames.forEach((f) => {
          const item = f.item as unknown as { type: string; asset_url: string | null } | null;
          if (item?.asset_url) {
            framesMap[f.user_id] = item.asset_url;
          }
        });
      }
    }

    const enrichMember = (m: (typeof membersList)[number]) => ({
        ...m,
        activeFrameUrl: framesMap[m.id] || null
    });
    
    const enrichedMembers = membersList.map(enrichMember);
    const filteredMembers = enrichedMembers.filter(
      (u) => u.id !== group.ownerUserId,
    );

    let ownerToReturn = membersList.find((u) => u.id === group.ownerUserId);
    
    if (!ownerToReturn) {
      const { data: ownerUser, error: ownerErr } = await this.supabase
        .from("users")
        .select("id, displayName, avatarUrl, elder")
        .eq("id", group.ownerUserId)
        .single();
        
      if (ownerErr || !ownerUser) {
        console.error("Owner not found in users: ", ownerErr);
        throw new ApiException(404, "Group owner not found");
      }
      ownerToReturn = ownerUser;
    }

    if (ownerToReturn) {
      const ownerFrame = framesMap[ownerToReturn.id] || null;
      
      return {
        name: group.name,
        owner: { ...ownerToReturn, activeFrameUrl: ownerFrame },
        members: filteredMembers.map(m => ({
          ...m,
          activeFrameUrl: framesMap[m.id] || null
        })),
      };
    }

    throw new ApiException(500, "Unexpected error resolving owner");
  }

  async updateGroupName(groupId: string, newName: string) {
    const { data, error } = await this.supabase
      .from("groups")
      .update({ name: newName })
      .eq("id", groupId)
      .select()
      .single();

    if (error) {
      console.error("Error updating group name:", error);
      throw new ApiException(500, "Error updating group name");
    }

    if (!data) {
      throw new ApiException(404, "Group not found");
    }

    return data;
  }

  async transferOwnership(
    groupId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ) {
    const { data: group, error: groupErr } = await this.supabase
      .from("groups")
      .select("id, name, ownerUserId")
      .eq("id", groupId)
      .single();

    if (groupErr) {
      console.error("Error fetching group:", groupErr);
      throw new ApiException(500, "Error fetching the group");
    }

    if (!group) {
      throw new ApiException(404, "Group not found");
    }

    if (group.ownerUserId !== currentOwnerId) {
      throw new ApiException(
        403,
        "Only the current group owner can transfer ownership",
      );
    }

    if (currentOwnerId === newOwnerId) {
      throw new ApiException(400, "Cannot transfer ownership to the same user");
    }

    const { data: membership, error: membershipErr } = await this.supabase
      .from("group_members")
      .select("id")
      .eq("groupId", groupId)
      .eq("userId", newOwnerId)
      .single();

    if (membershipErr || !membership) {
      throw new ApiException(400, "New owner must be a member of the group");
    }

    // Update roles in group_members
    await this.supabase
      .from("group_members")
      .update({ role: "member" })
      .eq("groupId", groupId)
      .eq("userId", currentOwnerId);

    await this.supabase
      .from("group_members")
      .update({ role: "owner" })
      .eq("groupId", groupId)
      .eq("userId", newOwnerId);

    return {
      group: {
        id: group.id,
        name: group.name,
        ownerUserId: newOwnerId,
        createdAt: new Date().toISOString(), // Fallback if missing
      },
      previousOwner: { id: currentOwnerId },
      newOwner: { id: newOwnerId, displayName: "New Owner" },
    };
  }

  async removeUserFromGroup(
    groupId: string,
    userId: string,
    adminUserId: string,
    createNewGroup: boolean = true,
  ): Promise<{
    removedFromGroupId: string;
    userId: string;
    createdNewGroup?: { id: string; name: string };
  } | null> {
    const { data: group, error: groupErr } = await this.supabase
      .from("groups")
      .select("id, ownerUserId")
      .eq("id", groupId)
      .single();

    if (groupErr) {
      console.error("Error fetching group: ", groupErr);
      throw new ApiException(500, "Error fetching the group");
    }
    if (!group) {
      throw new ApiException(404, "Group not found");
    }

    const isOwner = group.ownerUserId === adminUserId;
    const isSelfRemoval = userId === adminUserId;

    if (!isOwner && !isSelfRemoval) {
      throw new ApiException(
        403,
        "You can only remove yourself from the group or be removed by the group owner",
      );
    }

    const { data: membership, error: membershipErr } = await this.supabase
      .from("group_members")
      .select("id")
      .eq("groupId", groupId)
      .eq("userId", userId)
      .single();

    if (membershipErr || !membership) {
      throw new ApiException(404, "User is not a member of this group");
    }

    if (userId === group.ownerUserId && isSelfRemoval) {
      const { data: otherMembers, error: membersErr } = await this.supabase
        .from("group_members")
        .select("id")
        .eq("groupId", groupId)
        .neq("userId", userId);

      if (membersErr) {
        console.error("Error checking other members: ", membersErr);
        throw new ApiException(500, "Error checking group members");
      }

      if (otherMembers && otherMembers.length > 0) {
        throw new ApiException(
          400,
          "Group owner cannot leave the group while there are other members. Transfer ownership first.",
        );
      }
    }

    const { error: unlinkErr } = await this.supabase
      .from("group_members")
      .delete()
      .eq("groupId", groupId)
      .eq("userId", userId);

    if (unlinkErr) {
      console.error("Error removing user from group: ", unlinkErr);
      throw new ApiException(500, "Error removing the user from the group");
    }

    console.info(
      `[Groups] User ${userId} removed from group ${groupId} at ${new Date().toISOString()}`,
    );

    if (!createNewGroup) {
      console.info(
        `[Groups] User ${userId} left group without creating a new one at ${new Date().toISOString()}`,
      );
      return {
        removedFromGroupId: groupId,
        userId,
      };
    }

    const { data: userToRemove } = await this.supabase
      .from("users")
      .select("displayName")
      .eq("id", userId)
      .single();

    const createdGroupName = `Grupo de ${userToRemove?.displayName ?? "Usuario"}`;
    const createdGroup = await this.createGroup(userId, createdGroupName);
    const membershipCreated = await this.create({
        ownerUserId: userId,
        name: createdGroupName
    });

    if (!membershipCreated) {
      throw new ApiException(
        500,
        "User was removed from the group but failed to create a personal group",
      );
    }

    console.info(
      `[Groups] Created personal group ${createdGroup.id} ("${createdGroup.name}") for user ${userId} and reassigned at ${new Date().toISOString()}`,
    );

    return {
      removedFromGroupId: groupId,
      userId,
      createdNewGroup: { id: createdGroup.id, name: createdGroup.name },
    };
  }

  async listUserGroups(userId: string) {
    const { data, error } = await this.supabase
      .from("group_members")
      .select("role, joinedAt, groups (id, name, ownerUserId)")
      .eq("userId", userId);

    if (error) {
      console.error("Error listing user groups:", error);
      throw new ApiException(500, "Error listing user groups");
    }

    return (data ?? []).map(m => ({
      id: m.groups?.id,
      name: m.groups?.name,
      role: m.role,
      joinedAt: m.joinedAt,
      ownerUserId: m.groups?.ownerUserId,
    }));
  }

  private async createGroup(
    ownerUserId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    const { data, error } = await this.supabase
      .from("groups")
      .insert({ ownerUserId, name })
      .select("id, name")
      .single();

    if (error || !data) {
      console.error("Error creating the group: ", error);
      throw new ApiException(500, "Error creating the group");
    }

    return data;
  }

  async canAccessUserData(currentUserId: string, targetUserId: string): Promise<boolean> {
    if (currentUserId === targetUserId) {
      return true;
    }

    try {
      const { data: currentGroups } = await this.supabase
        .from("group_members")
        .select("groupId")
        .eq("userId", currentUserId);

      const { data: targetGroups } = await this.supabase
        .from("group_members")
        .select("groupId")
        .eq("userId", targetUserId);

      if (!currentGroups || !targetGroups) return false;

      const currentIds = new Set(currentGroups.map(g => g.groupId));
      const sharedGroups = targetGroups.filter(g => currentIds.has(g.groupId));

      if (sharedGroups.length === 0) {
        return false;
      }

      // Check if current user is an elder (they are restricted)
      const { data: currentUser } = await this.supabase
        .from("users")
        .select("elder")
        .eq("id", currentUserId)
        .single();

      if (currentUser?.elder === true) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error verificando permisos:", error);
      return false;
    }
  }
}
