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
  | { action: 'update'; id: string; payload: CustomerPayload };

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

const makeTemporaryPassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#$%';
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
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
      const password = trimOrNull(body.payload.password) || makeTemporaryPassword();
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
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(existingCustomer.auth_user_id, {
        email: normalized.email,
        user_metadata: metadata,
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

    return badRequest('Accion no soportada.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo procesar la solicitud.';
    return jsonResponse({ error: message }, 400);
  }
});
