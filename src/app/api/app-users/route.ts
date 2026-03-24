import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/app-users?emails=a@b.com,c@d.com
// Returns which emails have a Supabase Auth account (has_login: true/false)
export async function GET(req: NextRequest) {
  try {
    const emailsParam = req.nextUrl.searchParams.get("emails");
    if (!emailsParam) return NextResponse.json({ authEmails: [] });

    const emails = emailsParam.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const admin = createAdminClient();
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const authEmailSet = new Set(
      (usersData?.users ?? []).map((u) => u.email?.toLowerCase() ?? "")
    );
    const authEmails = emails.filter((e) => authEmailSet.has(e));
    return NextResponse.json({ authEmails });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unexpected error" }, { status: 500 });
  }
}

// POST /api/app-users — create a new app user (auth + role record)
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role, notes, restaurant_id } = await req.json();

    // Basic validation
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!email?.trim()) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!password || password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    if (!role) return NextResponse.json({ error: "Role is required" }, { status: 400 });
    if (!restaurant_id) return NextResponse.json({ error: "Restaurant is required" }, { status: 400 });

    const admin = createAdminClient();

    // 1. Check if auth user already exists by listing users (search by email)
    const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    let authUserId: string;

    if (existingAuthUser) {
      // User already has an auth account — just update their password if provided
      authUserId = existingAuthUser.id;
      if (password) {
        const { error: pwErr } = await admin.auth.admin.updateUserById(authUserId, { password });
        if (pwErr) return NextResponse.json({ error: "Failed to update password: " + pwErr.message }, { status: 500 });
      }
    } else {
      // Create new Supabase Auth user
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true, // auto-confirm so they can log in immediately
      });

      if (authError) {
        return NextResponse.json({ error: "Failed to create auth user: " + authError.message }, { status: 500 });
      }

      authUserId = authData.user.id;
    }

    // 2. Insert into app_user_roles
    const { error: roleError } = await admin.from("app_user_roles").upsert(
      {
        restaurant_id,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role,
        notes: notes?.trim() || null,
        is_active: true,
      },
      { onConflict: "restaurant_id,email" }
    );

    if (roleError) {
      return NextResponse.json({ error: "Failed to save role: " + roleError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId: authUserId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unexpected error" }, { status: 500 });
  }
}

// PATCH /api/app-users — update role or reset password
export async function PATCH(req: NextRequest) {
  try {
    const { id, email, name, role, notes, password, restaurant_id } = await req.json();
    if (!id) return NextResponse.json({ error: "User id is required" }, { status: 400 });

    const admin = createAdminClient();

    // Update role record
    const { error: roleError } = await admin
      .from("app_user_roles")
      .update({ name: name?.trim(), role, notes: notes?.trim() || null })
      .eq("id", id);

    if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

    // If a new password is provided, update OR create the auth user
    if (password && password.length >= 6 && email) {
      const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const authUser = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );
      if (authUser) {
        // Auth account exists — reset password
        const { error: pwErr } = await admin.auth.admin.updateUserById(authUser.id, { password });
        if (pwErr) return NextResponse.json({ error: "Role saved but password update failed: " + pwErr.message }, { status: 500 });
      } else {
        // No auth account yet (user was created before auth was wired up) — create one now
        const { error: createErr } = await admin.auth.admin.createUser({
          email: email.toLowerCase(),
          password,
          email_confirm: true,
        });
        if (createErr) return NextResponse.json({ error: "Role saved but failed to create login account: " + createErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unexpected error" }, { status: 500 });
  }
}
