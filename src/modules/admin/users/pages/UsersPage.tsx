import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileBadge,
  FileText,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  UserRound,
  X,
  Check,
} from 'lucide-react';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { ErrorState } from '../../../../components/ui/ErrorState';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { UserAvatar } from '../../../../components/ui/UserAvatar';
import { adminKeys } from '../../../../utils/queryKeys';
import {
  adminUsersService,
  agentFunctionLabels,
  type AgentFunction,
  type ManagedUserProfile,
  type UserFormValues,
  type UserType,
  userTypeLabels,
} from '../services/users.service';

interface UserFormState {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  avatar_path: string | null;
  identity_document_path: string | null;
  user_type: UserType;
  agent_functions: AgentFunction[];
  is_active: boolean;
  avatarFile: File | null;
  documentFile: File | null;
}

interface MediaPreview {
  title: string;
  url: string;
  kind: 'image' | 'pdf' | 'file';
}

const emptyForm: UserFormState = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  phone: '',
  avatar_path: null,
  identity_document_path: null,
  user_type: 'AGENT',
  agent_functions: ['DRIVER'],
  is_active: true,
  avatarFile: null,
  documentFile: null,
};

export const UsersPage = () => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ManagedUserProfile | null>(null);
  const [form, setForm] = useState<UserFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<UserType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [loadingPreviewPath, setLoadingPreviewPath] = useState<string | null>(null);

  const {
    data: users,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: adminKeys.users(),
    queryFn: adminUsersService.listUsers,
  });

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return (users || []).filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch) ||
        (user.phone || '').toLowerCase().includes(normalizedSearch);

      const matchesType = typeFilter === 'ALL' || user.user_type === typeFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && user.is_active) ||
        (statusFilter === 'INACTIVE' && !user.is_active);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [searchTerm, statusFilter, typeFilter, users]);

  const requiresDocument = form.user_type === 'ADMIN' || form.user_type === 'AGENT';

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form, selectedUser === null);
      const savedUser = selectedUser
        ? await adminUsersService.updateUser(selectedUser.id, payload)
        : await adminUsersService.createUser(payload);

      const fileUpdates: Partial<UserFormValues> = {};

      if (form.avatarFile) {
        fileUpdates.avatar_path = await adminUsersService.uploadUserFile(savedUser.id, 'user-avatars', form.avatarFile);
      }

      if (form.documentFile) {
        fileUpdates.identity_document_path = await adminUsersService.uploadUserFile(
          savedUser.id,
          'identity-documents',
          form.documentFile,
        );
      }

      if (Object.keys(fileUpdates).length > 0) {
        return adminUsersService.updateUser(savedUser.id, fileUpdates);
      }

      return savedUser;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.users() });
      closeForm();
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : 'No se pudo guardar el usuario.';
      setFormError(message);
    },
  });

  const avatarUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedUser) {
        throw new Error('Guarda el usuario antes de subir una foto.');
      }

      const avatarPath = await adminUsersService.uploadUserFile(selectedUser.id, 'user-avatars', file);
      return adminUsersService.updateUser(selectedUser.id, { avatar_path: avatarPath });
    },
    onSuccess: async (updatedUser) => {
      setSelectedUser(updatedUser);
      setForm((current) => ({
        ...current,
        avatar_path: updatedUser.avatar_path,
        avatarFile: null,
      }));
      await queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
    onError: (mutationError) => {
      const message = mutationError instanceof Error ? mutationError.message : 'No se pudo actualizar la foto.';
      setFormError(message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (user: ManagedUserProfile) => adminUsersService.updateUser(user.id, { is_active: !user.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users() }),
  });

  const openCreateForm = () => {
    setSelectedUser(null);
    setForm(emptyForm);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (user: ManagedUserProfile) => {
    setSelectedUser(user);
    setForm({
      email: user.email,
      password: '',
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || '',
      avatar_path: user.avatar_path,
      identity_document_path: user.identity_document_path,
      user_type: user.user_type,
      agent_functions: user.agent_functions || [],
      is_active: user.is_active,
      avatarFile: null,
      documentFile: null,
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setSelectedUser(null);
    setForm(emptyForm);
    setFormError('');
  };

  const handleUserTypeChange = (userType: UserType) => {
    setForm((current) => ({
      ...current,
      user_type: userType,
      agent_functions: userType === 'AGENT' ? (current.agent_functions.length ? current.agent_functions : ['DRIVER']) : [],
    }));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>, key: 'avatarFile' | 'documentFile') => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';

    if (!file) {
      if (key === 'avatarFile') {
        setForm((current) => ({ ...current, avatarFile: null }));
      }
      return;
    }

    if (key === 'avatarFile' && !file.type.startsWith('image/')) {
      setFormError('Selecciona una imagen valida para la foto.');
      return;
    }

    setFormError('');

    if (key === 'avatarFile' && selectedUser) {
      avatarUploadMutation.mutate(file);
      return;
    }

    setForm((current) => ({ ...current, [key]: file }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    if (!form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      setFormError('Completa correo, nombre y apellidos.');
      return;
    }

    if (!selectedUser && form.password.trim().length < 8) {
      setFormError('La contrasena temporal debe tener al menos 8 caracteres.');
      return;
    }

    if (selectedUser && form.password.trim() && form.password.trim().length < 8) {
      setFormError('La nueva contrasena debe tener al menos 8 caracteres.');
      return;
    }

    if (form.user_type === 'AGENT' && form.agent_functions.length === 0) {
      setFormError('Selecciona al menos una funcion del agente.');
      return;
    }

    if (requiresDocument && !form.identity_document_path && !form.documentFile) {
      setFormError('Carga el documento oficial requerido.');
      return;
    }

    saveMutation.mutate();
  };

  const openAvatarPreview = (user: ManagedUserProfile) => {
    setPreviewError('');
    const url = adminUsersService.getAvatarUrl(user.avatar_path);

    if (!url) {
      setPreviewError('Este usuario no tiene foto cargada.');
      return;
    }

    setMediaPreview({
      title: `Foto de ${user.first_name} ${user.last_name}`,
      url,
      kind: 'image',
    });
  };

  const openFormAvatarPreview = () => {
    setFormError('');

    if (form.avatarFile) {
      setMediaPreview({
        title: form.avatarFile.name,
        url: URL.createObjectURL(form.avatarFile),
        kind: 'image',
      });
      return;
    }

    const url = adminUsersService.getAvatarUrl(form.avatar_path);

    if (!url) {
      setFormError('Este usuario no tiene foto cargada.');
      return;
    }

    setMediaPreview({
      title: `Foto de ${form.first_name || 'usuario'} ${form.last_name}`.trim(),
      url,
      kind: 'image',
    });
  };

  const openDocumentPreview = async (user: ManagedUserProfile) => {
    if (!user.identity_document_path) {
      setPreviewError('Este usuario no tiene documento cargado.');
      return;
    }

    setPreviewError('');
    setLoadingPreviewPath(user.identity_document_path);

    try {
      const url = await adminUsersService.getDocumentUrl(user.identity_document_path);
      setMediaPreview({
        title: adminUsersService.getFileName(user.identity_document_path) || `Documento de ${user.first_name}`,
        url,
        kind: adminUsersService.getFileKind(user.identity_document_path),
      });
    } catch (previewErrorCaught) {
      const message =
        previewErrorCaught instanceof Error ? previewErrorCaught.message : 'No se pudo abrir el documento.';
      setPreviewError(message);
    } finally {
      setLoadingPreviewPath(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-32 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-4 w-64 animate-pulse rounded-lg bg-gray-200" />
          </div>
          <div className="h-10 w-36 animate-pulse rounded-lg bg-gray-200" />
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="h-11 w-full flex-1 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-11 w-full sm:w-40 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-11 w-full sm:w-40 animate-pulse rounded-lg bg-gray-200" />
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50/50 p-4">
            <div className="flex justify-between gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-200" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
                <div className="hidden h-4 w-24 animate-pulse rounded bg-gray-200 md:block" />
                <div className="hidden h-8 w-8 animate-pulse rounded-lg bg-gray-200 sm:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.';
    return <ErrorState message={message} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-[26px] font-bold tracking-tight text-[#1D1D1F] sm:text-[28px]">Usuarios</h2>
          <p className="text-[14px] text-[#86868B] sm:text-[15px]">Acceso, perfil, documentos y estado operativo.</p>
        </div>
        <div className="grid gap-2 sm:flex">
          <button
            type="button"
            onClick={openCreateForm}
            className="flex items-center justify-center gap-2 rounded-lg bg-[#0066CC] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0057AD]"
          >
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </button>
        </div>
      </div>


      <div className="grid gap-3 rounded-lg border border-gray-200/70 bg-white p-3 shadow-sm lg:grid-cols-[minmax(0,1fr)_180px_180px]">
        <label className="flex h-11 items-center gap-2 rounded-lg border border-gray-300 px-3 focus-within:border-[#0066CC] focus-within:ring-2 focus-within:ring-[#0066CC]/15">
          <Search className="h-4 w-4 text-[#86868B]" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Buscar por nombre, correo o telefono"
          />
        </label>
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as UserType | 'ALL')}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15"
        >
          <option value="ALL">Todos los tipos</option>
          <option value="CUSTOMER">Clientes</option>
          <option value="AGENT">Agentes</option>
          <option value="ADMIN">Administradores</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15"
        >
          <option value="ALL">Todos los estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="INACTIVE">Inactivos</option>
        </select>
      </div>

      {previewError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {previewError}
        </div>
      )}

      {!filteredUsers.length ? (
        <EmptyState
          title="No hay usuarios"
          description="No se encontraron usuarios con los filtros actuales."
          icon={<UserRound className="h-6 w-6 text-gray-400" />}
          action={
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0066CC] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0057AD]"
            >
              <Plus className="h-4 w-4" />
              Nuevo usuario
            </button>
          }
        />
      ) : (
        <>
          <div className="hidden w-full overflow-x-auto rounded-lg border border-gray-200/70 bg-white shadow-sm lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-gray-200/70 text-[#86868B]">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Usuario</th>
                  <th className="px-5 py-3.5 font-semibold">Tipo</th>
                  <th className="px-5 py-3.5 font-semibold">Funciones</th>
                  <th className="px-5 py-3.5 font-semibold">Contacto</th>
                  <th className="px-5 py-3.5 font-semibold">Archivos</th>
                  <th className="px-5 py-3.5 font-semibold">Estado</th>
                  <th className="px-5 py-3.5 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-[#F5F5F7]/50">
                    <td className="px-5 py-3.5">
                      <UserIdentity user={user} onAvatarClick={() => openAvatarPreview(user)} />
                    </td>
                    <td className="px-5 py-3.5">
                      <UserTypeBadge userType={user.user_type} />
                    </td>
                    <td className="px-5 py-3.5 text-[#424245]">
                      {formatAgentFunctions(user.agent_functions)}
                    </td>
                    <td className="px-5 py-3.5 text-[#424245]">
                      <p>{user.phone || '-'}</p>
                      <p className="mt-0.5 text-[12px] text-[#86868B]">{user.email}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <MediaActions
                        user={user}
                        loadingPreviewPath={loadingPreviewPath}
                        onDocumentPreview={() => openDocumentPreview(user)}
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={user.is_active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-5 py-3.5">
                      <RowActions
                        user={user}
                        isPending={toggleActiveMutation.isPending}
                        onEdit={() => openEditForm(user)}
                        onToggle={() => toggleActiveMutation.mutate(user)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {filteredUsers.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                loadingPreviewPath={loadingPreviewPath}
                isTogglePending={toggleActiveMutation.isPending}
                onEdit={() => openEditForm(user)}
                onToggle={() => toggleActiveMutation.mutate(user)}
                onAvatarPreview={() => openAvatarPreview(user)}
                onDocumentPreview={() => openDocumentPreview(user)}
              />
            ))}
          </div>
        </>
      )}

      {isFormOpen && (
        <UserFormDialog
          form={form}
          isEditing={selectedUser !== null}
          isPending={saveMutation.isPending || avatarUploadMutation.isPending}
          isAvatarUploading={avatarUploadMutation.isPending}
          errorMessage={formError}
          requiresDocument={requiresDocument}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onChange={setForm}
          onUserTypeChange={handleUserTypeChange}
          onFileChange={handleFileChange}
          onAvatarPreview={openFormAvatarPreview}
          onDocumentPreview={() => selectedUser && openDocumentPreview(selectedUser)}
        />
      )}

      {mediaPreview && <MediaViewer preview={mediaPreview} onClose={() => setMediaPreview(null)} />}
    </div>
  );
};

const buildPayload = (form: UserFormState, includePassword: boolean): UserFormValues => {
  const password = form.password.trim();

  return {
    email: form.email.trim().toLowerCase(),
    password: includePassword || password ? password : undefined,
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    phone: form.phone.trim() || null,
    avatar_path: form.avatar_path,
    identity_document_path: form.identity_document_path,
    user_type: form.user_type,
    agent_functions: form.user_type === 'AGENT' ? form.agent_functions : [],
    is_active: form.is_active,
  };
};

const formatAgentFunctions = (functions: AgentFunction[] | null | undefined) => {
  if (!functions?.length) return '-';
  return functions.map((agentFunction) => agentFunctionLabels[agentFunction]).join(', ');
};

const UserIdentity = ({ user, onAvatarClick }: { user: ManagedUserProfile; onAvatarClick: () => void }) => {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:min-w-[220px] sm:gap-3">
      <button type="button" onClick={onAvatarClick} className="rounded-full focus:outline-none focus:ring-2 focus:ring-[#0066CC]/30">
        <UserAvatar
          firstName={user.first_name}
          lastName={user.last_name}
          avatarPath={user.avatar_path}
          className="h-9 w-9 sm:h-10 sm:w-10"
          imageClassName="h-9 w-9 rounded-full object-cover sm:h-10 sm:w-10"
        />
      </button>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[#1D1D1F] sm:text-[13px]">{`${user.first_name} ${user.last_name}`}</p>
        <p className="truncate text-[12px] text-[#86868B]">{user.email}</p>
      </div>
    </div>
  );
};

const UserTypeBadge = ({ userType }: { userType: UserType }) => {
  return (
    <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-blue-700">
      {userTypeLabels[userType]}
    </span>
  );
};

interface MediaActionsProps {
  user: ManagedUserProfile;
  loadingPreviewPath: string | null;
  onDocumentPreview: () => void;
}

const MediaActions = ({ user, loadingPreviewPath, onDocumentPreview }: MediaActionsProps) => {
  const hasFiles = Boolean(user.identity_document_path);

  if (!hasFiles) {
    return <span className="text-[12px] text-[#86868B]">Sin archivos</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {user.identity_document_path && (
        <MediaButton
          label={loadingPreviewPath === user.identity_document_path ? 'Abriendo...' : 'Documento'}
          icon={<FileBadge className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          disabled={loadingPreviewPath === user.identity_document_path}
          onClick={onDocumentPreview}
        />
      )}
    </div>
  );
};

interface MediaButtonProps {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}

const MediaButton = ({ label, icon, disabled, onClick }: MediaButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 text-[11px] font-medium text-[#424245] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300 sm:h-8 sm:px-2.5 sm:text-[12px]"
    >
      {icon}
      {label}
    </button>
  );
};

interface RowActionsProps {
  user: ManagedUserProfile;
  isPending: boolean;
  onEdit: () => void;
  onToggle: () => void;
}

const RowActions = ({ user, isPending, onEdit, onToggle }: RowActionsProps) => {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onEdit}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#424245] transition-colors hover:bg-gray-50"
        title="Editar"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggle}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-[#424245] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
        title={user.is_active ? 'Desactivar' : 'Activar'}
        disabled={isPending}
      >
        {user.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
      </button>
    </div>
  );
};

interface UserCardProps {
  user: ManagedUserProfile;
  loadingPreviewPath: string | null;
  isTogglePending: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onAvatarPreview: () => void;
  onDocumentPreview: () => void;
}

const UserCard = ({
  user,
  loadingPreviewPath,
  isTogglePending,
  onEdit,
  onToggle,
  onAvatarPreview,
  onDocumentPreview,
}: UserCardProps) => {
  return (
    <article className="rounded-lg border border-gray-200/70 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <UserIdentity user={user} onAvatarClick={onAvatarPreview} />
        <StatusBadge status={user.is_active ? 'ACTIVE' : 'INACTIVE'} />
      </div>

      <div className="mt-3 grid gap-2 text-[12px] text-[#424245]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#86868B]">Tipo</span>
          <UserTypeBadge userType={user.user_type} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#86868B]">Funciones</span>
          <span className="min-w-0 truncate text-right">{formatAgentFunctions(user.agent_functions)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#86868B]">Telefono</span>
          <span>{user.phone || '-'}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <MediaActions
          user={user}
          loadingPreviewPath={loadingPreviewPath}
          onDocumentPreview={onDocumentPreview}
        />
        <RowActions user={user} isPending={isTogglePending} onEdit={onEdit} onToggle={onToggle} />
      </div>
    </article>
  );
};

interface EditableUserAvatarProps {
  firstName: string;
  lastName: string;
  avatarPath: string | null;
  file: File | null;
  isUploading: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPreview: () => void;
}

const EditableUserAvatar = ({
  firstName,
  lastName,
  avatarPath,
  file,
  isUploading,
  onFileChange,
  onPreview,
}: EditableUserAvatarProps) => {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarPressTimerRef = useRef<number | null>(null);
  const didOpenAvatarPreviewRef = useRef(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState('');
  const avatarUrl = localAvatarUrl || adminUsersService.getAvatarUrl(avatarPath);
  const canPreview = Boolean(avatarUrl);

  const clearAvatarPressTimer = () => {
    if (!avatarPressTimerRef.current) return;
    window.clearTimeout(avatarPressTimerRef.current);
    avatarPressTimerRef.current = null;
  };

  useEffect(() => {
    if (!file) {
      setLocalAvatarUrl('');
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setLocalAvatarUrl(nextUrl);

    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  useEffect(() => {
    return () => {
      clearAvatarPressTimer();
    };
  }, []);

  const startAvatarPress = () => {
    didOpenAvatarPreviewRef.current = false;
    clearAvatarPressTimer();

    if (!canPreview || isUploading) return;

    avatarPressTimerRef.current = window.setTimeout(() => {
      didOpenAvatarPreviewRef.current = true;
      avatarPressTimerRef.current = null;
      onPreview();
    }, 550);
  };

  const cancelAvatarPress = () => {
    clearAvatarPressTimer();
  };

  const handleAvatarClick = () => {
    if (didOpenAvatarPreviewRef.current) {
      didOpenAvatarPreviewRef.current = false;
      return;
    }

    avatarInputRef.current?.click();
  };

  return (
    <div className="group relative h-20 w-20 overflow-hidden rounded-full bg-[#0066CC]/10">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
      ) : (
        <UserAvatar
          firstName={firstName}
          lastName={lastName}
          avatarPath={null}
          className="h-20 w-20 text-xl"
          imageClassName="h-20 w-20 rounded-full object-cover"
        />
      )}
      <button
        type="button"
        onClick={handleAvatarClick}
        onPointerDown={startAvatarPress}
        onPointerUp={cancelAvatarPress}
        onPointerLeave={cancelAvatarPress}
        onPointerCancel={cancelAvatarPress}
        onContextMenu={(event) => event.preventDefault()}
        disabled={isUploading}
        className="absolute inset-0 flex touch-manipulation select-none items-center justify-center bg-black/45 text-[12px] font-semibold text-white opacity-100 transition-opacity hover:bg-black/55 disabled:cursor-wait sm:opacity-0 sm:group-hover:opacity-100"
        title="Actualizar foto. Mantener presionado para verla."
        aria-label="Actualizar foto de usuario. Mantener presionado para verla."
      >
        {isUploading ? 'Subiendo...' : 'Actualizar'}
      </button>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onFileChange}
        className="sr-only"
      />
    </div>
  );
};

interface UserFormDialogProps {
  form: UserFormState;
  isEditing: boolean;
  isPending: boolean;
  isAvatarUploading: boolean;
  errorMessage: string;
  requiresDocument: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: (value: UserFormState | ((current: UserFormState) => UserFormState)) => void;
  onUserTypeChange: (userType: UserType) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>, key: 'avatarFile' | 'documentFile') => void;
  onAvatarPreview: () => void;
  onDocumentPreview: () => void;
}

const UserFormDialog = ({
  form,
  isEditing,
  isPending,
  isAvatarUploading,
  errorMessage,
  requiresDocument,
  onClose,
  onSubmit,
  onChange,
  onUserTypeChange,
  onFileChange,
  onAvatarPreview,
  onDocumentPreview,
}: UserFormDialogProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center overflow-x-hidden bg-black/30 p-0 sm:items-center sm:px-4 sm:py-6">
      <form
        onSubmit={onSubmit}
        className="flex h-[100dvh] w-full max-w-full flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[calc(100vh-1.5rem)] sm:max-w-4xl sm:rounded-lg sm:border sm:border-gray-200"
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0066CC]/10 text-[#0066CC] sm:h-10 sm:w-10">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                {isEditing ? 'Editar usuario' : 'Nuevo usuario'}
              </h3>
              <p className="truncate text-[13px] text-[#86868B]">Perfil operativo, archivos y acceso.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#86868B] transition-colors hover:bg-gray-100 hover:text-[#1D1D1F]"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="min-w-0 space-y-4 px-3 py-4 sm:px-6 sm:py-5">
            <div className="rounded-lg border border-gray-200 bg-[#F5F5F7] p-4">
              <div className="flex flex-col items-center text-center">
              <EditableUserAvatar
                firstName={form.first_name}
                lastName={form.last_name}
                avatarPath={form.avatar_path}
                file={form.avatarFile}
                isUploading={isAvatarUploading}
                onFileChange={(event) => onFileChange(event, 'avatarFile')}
                onPreview={onAvatarPreview}
              />
              <p className="mt-3 max-w-full truncate text-sm font-semibold text-[#1D1D1F]">
                {form.first_name || form.last_name ? `${form.first_name} ${form.last_name}` : 'Usuario'}
              </p>
              <p className="mt-0.5 max-w-full truncate text-[12px] text-[#86868B]">{form.email || 'sin correo'}</p>
              </div>
            </div>

            <div className="grid min-w-0 gap-3 sm:gap-4 md:grid-cols-2">
            <TextInput
              label="Correo"
              type="email"
              value={form.email}
              autoComplete="email"
              onChange={(value) => onChange((current) => ({ ...current, email: value }))}
            />
              <TextInput
              label={isEditing ? 'Nueva contrasena' : 'Contrasena temporal'}
              type="password"
              value={form.password}
              autoComplete="new-password"
              placeholder={isEditing ? 'Dejar vacio para conservar' : ''}
              required={!isEditing}
              onChange={(value) => onChange((current) => ({ ...current, password: value }))}
            />
              <TextInput
              label="Nombre"
              value={form.first_name}
              autoComplete="given-name"
              onChange={(value) => onChange((current) => ({ ...current, first_name: value }))}
            />
              <TextInput
              label="Apellidos"
              value={form.last_name}
              autoComplete="family-name"
              onChange={(value) => onChange((current) => ({ ...current, last_name: value }))}
            />
              <TextInput
              label="Telefono"
              type="tel"
              value={form.phone}
              autoComplete="tel"
              required={false}
              onChange={(value) => onChange((current) => ({ ...current, phone: value }))}
            />
              <label className="block min-w-0">
              <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">Tipo</span>
              {isEditing && form.user_type === 'CUSTOMER' ? (
                <input
                  value="Cliente"
                  disabled
                  className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-[#86868B] outline-none sm:h-11"
                />
              ) : (
                <select
                  value={form.user_type}
                  onChange={(event) => onUserTypeChange(event.target.value as UserType)}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15 sm:h-11"
                >
                  <option value="AGENT">Agente</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              )}
              </label>

              {form.user_type === 'AGENT' && (
              <AgentFunctionPicker
                values={form.agent_functions}
                onChange={(nextFunctions) =>
                  onChange((current) => ({ ...current, agent_functions: nextFunctions }))
                }
              />
            )}

              <div className="min-w-0 space-y-2">
              <FileInput
                label={`Documento oficial${requiresDocument ? ' *' : ''}`}
                accept="image/png,image/jpeg,image/webp,application/pdf"
                file={form.documentFile}
                existingPath={form.identity_document_path}
                onChange={(event) => onFileChange(event, 'documentFile')}
              />
              {form.identity_document_path && (
                <button
                  type="button"
                  onClick={onDocumentPreview}
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-[12px] font-medium text-[#424245] transition-colors hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4" />
                  Ver documento
                </button>
              )}
            </div>

              <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 md:col-span-2">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => onChange((current) => ({ ...current, is_active: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-[#0066CC] focus:ring-[#0066CC]"
              />
              <span className="text-sm font-medium text-[#1D1D1F]">Usuario activo</span>
              </label>
          </div>
          </div>

          {errorMessage && (
            <div className="mx-3 mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 sm:mx-6 sm:mb-5">
              {errorMessage}
            </div>
          )}
          </div>

        <div className="grid gap-2 border-t border-gray-200 bg-white px-3 py-3 sm:flex sm:justify-end sm:px-6 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 rounded-lg bg-[#0066CC] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0057AD] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isPending ? 'Guardando...' : 'Guardar usuario'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}

interface AgentFunctionPickerProps {
  values: AgentFunction[];
  onChange: (agentFunctions: AgentFunction[]) => void;
}

const agentFunctionOptions: AgentFunction[] = ['DRIVER', 'SALESPERSON', 'WAREHOUSE'];

const AgentFunctionPicker = ({ values, onChange }: AgentFunctionPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selectedFunctions = agentFunctionOptions.filter((agentFunction) => values.includes(agentFunction));

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const toggleFunction = (agentFunction: AgentFunction) => {
    const nextFunctions = values.includes(agentFunction)
      ? values.filter((value) => value !== agentFunction)
      : [...values, agentFunction];

    onChange(nextFunctions);
  };

  return (
    <div ref={pickerRef} className="relative block min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">Funciones</span>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm outline-none transition-colors hover:bg-gray-50 focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15 sm:h-11 ${
          isOpen ? 'border-[#0066CC] ring-2 ring-[#0066CC]/15' : 'border-gray-300'
        }`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          {!selectedFunctions.length ? (
            <span className="truncate text-[#86868B]">Selecciona funciones</span>
          ) : (
            <>
              {selectedFunctions.slice(0, 2).map((agentFunction) => (
                <span
                  key={agentFunction}
                  className="max-w-[105px] truncate rounded-md bg-[#0066CC]/10 px-2 py-0.5 text-[12px] font-medium text-[#0066CC]"
                >
                  {agentFunctionLabels[agentFunction]}
                </span>
              ))}
              {selectedFunctions.length > 2 && (
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[12px] font-medium text-[#424245]">
                  +{selectedFunctions.length - 2}
                </span>
              )}
            </>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#86868B] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {agentFunctionOptions.map((agentFunction) => {
            const isChecked = values.includes(agentFunction);

            return (
              <button
                key={agentFunction}
                type="button"
                onClick={() => toggleFunction(agentFunction)}
                className={`flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[13px] transition-colors ${
                  isChecked ? 'bg-[#0066CC]/10 text-[#0066CC]' : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                }`}
              >
                <span className="truncate">{agentFunctionLabels[agentFunction]}</span>
                {isChecked && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TextInput = ({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  required = true,
}: TextInputProps) => {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">{label}</span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15 sm:h-11"
      />
    </label>
  );
};

interface FileInputProps {
  label: string;
  accept: string;
  file: File | null;
  existingPath?: string | null;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const FileInput = ({ label, accept, file, existingPath, onChange }: FileInputProps) => {
  const displayName = file ? file.name : adminUsersService.getFileName(existingPath || '') || 'Sin archivo';

  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">{label}</span>
      <span className="flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 text-sm transition-colors hover:bg-gray-50 sm:h-11">
        <span className="shrink-0 rounded-md bg-gray-100 px-2.5 py-1.5 text-[12px] font-medium text-[#1D1D1F]">
          Seleccionar
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#86868B]">{displayName}</span>
        <input type="file" accept={accept} onChange={onChange} className="sr-only" />
      </span>
      {(file || existingPath) && (
        <span className="mt-1.5 block max-w-full truncate text-[12px] text-[#86868B]">
          {displayName}
        </span>
      )}
    </label>
  );
};

interface MediaViewerProps {
  preview: MediaPreview;
  onClose: () => void;
}

const MediaViewer = ({ preview, onClose }: MediaViewerProps) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-3 py-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[#1D1D1F]">{preview.title}</h3>
            <p className="text-[12px] text-[#86868B]">{preview.kind === 'pdf' ? 'PDF' : preview.kind === 'image' ? 'Imagen' : 'Archivo'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#86868B] transition-colors hover:bg-gray-100 hover:text-[#1D1D1F]"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-[320px] flex-1 bg-[#F5F5F7] p-3">
          {preview.kind === 'image' && (
            <img src={preview.url} alt="" className="mx-auto max-h-[calc(100vh-9rem)] w-auto max-w-full rounded-lg object-contain" />
          )}
          {preview.kind === 'pdf' && (
            <iframe title={preview.title} src={preview.url} className="h-[calc(100vh-9rem)] min-h-[320px] w-full rounded-lg bg-white" />
          )}
          {preview.kind === 'file' && (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <FileText className="mb-3 h-10 w-10 text-[#86868B]" />
              <p className="text-sm font-medium text-[#1D1D1F]">Vista previa no disponible.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
