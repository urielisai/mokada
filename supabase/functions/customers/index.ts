import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CustomerPayload = {
  name?: string;
  email?: string;
  phone?: string;
  requires_invoice?: boolean;
  is_active?: boolean;
  password?: string;
};

type CustomerRequest =
  | { action: 'create'; payload: CustomerPayload }
  | { action: 'update'; id: string; payload: CustomerPayload }
  | { action: 'cleanup_without_branches'; ids: string[] };

const jsonResponse = (body: Record<string, unknown>, status = 200) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
};

const badRequest = (message: string) => jsonResponse({ error: message }, 400);

const trimOrNull = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeCustomer = (payload: CustomerPayload) => {
  const name = trimOrNull(payload.name);
  const email = trimOrNull(payload.email)?.toLowerCase();
  const phone = trimOrNull(payload.phone);

  if (!name) throw new Error('El nombre del cliente es obligatorio.');
  if (!email) throw new Error('El correo del cliente es obligatorio.');
  if (!phone) throw new Error('El telefono del cliente es obligatorio.');

  return {
    name,
    email,
    phone,
    requires_invoice: payload.requires_invoice ?? false,
    is_active: payload.is_active ?? true,
  };
};

const findUserByEmail = async (adminClient: ReturnType<typeof createClient>, email: string) => {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
    page += 1;
  }
};

const customerMetadata = (name: string) => ({
  first_name: name,
  last_name: 'Cliente',
  user_type: 'CUSTOMER',
  agent_functions: [],
});

const defaultCustomerPassword = '12345678';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo no permitido.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Faltan variables de entorno de Supabase.' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Sesion requerida.' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: 'Sesion no valida.' }, 401);
  }

  const { data: requesterProfile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('auth_user_id, user_type, agent_functions, is_active')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse({ error: profileError.message }, 500);
  }

  const canManageCustomers =
    requesterProfile?.is_active &&
    (requesterProfile.user_type === 'ADMIN' ||
      (requesterProfile.user_type === 'AGENT' && requesterProfile.agent_functions?.includes('SALESPERSON')));

  if (!canManageCustomers) {
    return jsonResponse({ error: 'Necesitas permisos para gestionar clientes.' }, 403);
  }

  let body: CustomerRequest;
  try {
    body = await req.json();
  } catch {
    return badRequest('Solicitud JSON invalida.');
  }

  try {
    if (body.action === 'create') {
      const normalized = normalizeCustomer(body.payload);
      const password = trimOrNull(body.payload.password) || defaultCustomerPassword;
      if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      const metadata = customerMetadata(normalized.name);

      let authUserId: string | undefined;
      let createdAuthUser = false;

      const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
        email: normalized.email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (createError) {
        const existingUser = await findUserByEmail(adminClient, normalized.email);
        if (!existingUser) throw createError;

        const { error: existingCustomerError, data: existingCustomer } = await adminClient
          .from('customers')
          .select('id')
          .eq('auth_user_id', existingUser.id)
          .maybeSingle();

        if (existingCustomerError) throw existingCustomerError;
        if (existingCustomer) throw new Error('Ya existe un cliente con ese correo.');

        const { error: existingProfileError, data: existingProfile } = await adminClient
          .from('user_profiles')
          .select('user_type')
          .eq('auth_user_id', existingUser.id)
          .maybeSingle();

        if (existingProfileError) throw existingProfileError;
        if (existingProfile && existingProfile.user_type !== 'CUSTOMER') {
          throw new Error('Ese correo ya pertenece a un usuario operativo.');
        }

        const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: metadata,
        });

        if (updateAuthError) throw updateAuthError;
        authUserId = existingUser.id;
      } else {
        authUserId = createdUser.user?.id;
        createdAuthUser = true;
      }

      if (!authUserId) throw new Error('No se pudo crear el usuario del cliente.');

      const { data: customer, error: customerError } = await adminClient
        .from('customers')
        .insert({
          ...normalized,
          auth_user_id: authUserId,
          created_by: user.id,
        })
        .select('*')
        .single();

      if (customerError) {
        if (createdAuthUser) {
          await adminClient.auth.admin.deleteUser(authUserId);
        }
        throw customerError;
      }

      const { error: profileSyncError } = await adminClient
        .from('user_profiles')
        .upsert(
          {
            auth_user_id: authUserId,
            email: normalized.email,
            first_name: normalized.name,
            last_name: 'Cliente',
            phone: normalized.phone,
            user_type: 'CUSTOMER',
            agent_functions: [],
            is_active: normalized.is_active,
          },
          { onConflict: 'auth_user_id' },
        );

      if (profileSyncError) throw profileSyncError;

      return jsonResponse({ data: { customer, temporary_password: password } }, 201);
    }

    if (body.action === 'update') {
      const normalized = normalizeCustomer(body.payload);

      const { data: existingCustomer, error: existingError } = await adminClient
        .from('customers')
        .select('*')
        .eq('id', body.id)
        .single();

      if (existingError) throw existingError;

      const metadata = customerMetadata(normalized.name);
      const password = trimOrNull(body.payload.password);
      if (password && password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(existingCustomer.auth_user_id, {
        email: normalized.email,
        user_metadata: metadata,
        ...(password ? { password } : {}),
      });

      if (authUpdateError) throw authUpdateError;

      const { data: customer, error: customerError } = await adminClient
        .from('customers')
        .update(normalized)
        .eq('id', body.id)
        .select('*')
        .single();

      if (customerError) throw customerError;

      const { error: profileSyncError } = await adminClient
        .from('user_profiles')
        .update({
          email: normalized.email,
          first_name: normalized.name,
          last_name: 'Cliente',
          phone: normalized.phone,
          user_type: 'CUSTOMER',
          agent_functions: [],
          is_active: normalized.is_active,
        })
        .eq('auth_user_id', existingCustomer.auth_user_id);

      if (profileSyncError) throw profileSyncError;

      return jsonResponse({ data: { customer } });
    }

    if (body.action === 'cleanup_without_branches') {
      if (requesterProfile?.user_type !== 'ADMIN') {
        return jsonResponse({ error: 'Solo los administradores pueden ejecutar la limpieza de clientes.' }, 403);
      }

      const requestedIds = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
      if (!requestedIds.length) {
        return jsonResponse({ data: { deletedIds: [] } });
      }

      const { data: branches, error: branchesError } = await adminClient
        .from('customer_branches')
        .select('customer_id')
        .in('customer_id', requestedIds);

      if (branchesError) throw branchesError;

      const withBranchSet = new Set((branches || []).map((b: { customer_id: string }) => b.customer_id));

      const { data: orders, error: ordersError } = await adminClient
        .from('sales_orders')
        .select('customer_id')
        .in('customer_id', requestedIds);

      if (ordersError) throw ordersError;

      const withOrderSet = new Set((orders || []).map((o: { customer_id: string }) => o.customer_id));
      const safeToDeleteIds = requestedIds.filter((id) => !withBranchSet.has(id) && !withOrderSet.has(id));

      if (!safeToDeleteIds.length) {
        return jsonResponse({ data: { deletedIds: [] } });
      }

      const { data: customersToDelete, error: fetchError } = await adminClient
        .from('customers')
        .select('id, auth_user_id')
        .in('id', safeToDeleteIds);

      if (fetchError) throw fetchError;

      const { error: deleteError } = await adminClient
        .from('customers')
        .delete()
        .in('id', safeToDeleteIds);

      if (deleteError) throw deleteError;

      for (const customerRow of customersToDelete || []) {
        if (customerRow.auth_user_id) {
          await adminClient
            .from('user_profiles')
            .delete()
            .eq('auth_user_id', customerRow.auth_user_id)
            .eq('user_type', 'CUSTOMER');
          await adminClient.auth.admin.deleteUser(customerRow.auth_user_id).catch(() => null);
        }
      }

      return jsonResponse({ data: { deletedIds: safeToDeleteIds } });
    }

    return badRequest('Accion no soportada.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo procesar la solicitud.';
    return jsonResponse({ error: message }, 400);
  }
});
