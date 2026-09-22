import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, Save, UserRound, X } from 'lucide-react';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import { storageService } from '../../../lib/supabase/storage';
import { useAuth } from '../context/useAuth';

interface MediaPreview {
  title: string;
  url: string;
}

export const ProfilePage = () => {
  const { profile, updateAvatar, updatePassword, updateProfile } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarPressTimerRef = useRef<number | null>(null);
  const didOpenAvatarPreviewRef = useRef(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<MediaPreview | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name);
    setLastName(profile.last_name);
    setPhone(profile.phone || '');
  }, [profile]);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Selecciona una imagen valida para tu foto de perfil.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsAvatarUploading(true);

    try {
      await updateAvatar(file);
      setSuccessMessage('Foto actualizada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la foto.';
      setErrorMessage(message);
    } finally {
      setIsAvatarUploading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Nombre y apellidos son obligatorios.');
      return;
    }

    setIsSubmitting(true);

    try {
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
      });
      setSuccessMessage('Perfil actualizado.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el perfil.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAvatarPreview = () => {
    const url = storageService.getPublicUrl('user-avatars', profile?.avatar_path || null);
    if (!url) {
      setErrorMessage('Aún no tienes foto cargada.');
      return;
    }

    setPreview({
      title: 'Foto de perfil',
      url,
    });
  };

  const clearAvatarPressTimer = () => {
    if (!avatarPressTimerRef.current) return;
    window.clearTimeout(avatarPressTimerRef.current);
    avatarPressTimerRef.current = null;
  };

  const startAvatarPress = () => {
    didOpenAvatarPreviewRef.current = false;
    clearAvatarPressTimer();

    if (!profile?.avatar_path || isAvatarUploading) return;

    avatarPressTimerRef.current = window.setTimeout(() => {
      didOpenAvatarPreviewRef.current = true;
      avatarPressTimerRef.current = null;
      openAvatarPreview();
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[26px] font-bold tracking-tight text-[#1D1D1F] sm:text-[28px]">Mi perfil</h2>
          <p className="text-[14px] text-[#86868B] sm:text-[15px]">Actualiza tu información personal.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsPasswordDialogOpen(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-gray-50"
        >
          <KeyRound className="h-4 w-4" />
          Cambiar contraseña
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-lg border border-gray-200/70 bg-white p-5 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="group relative h-24 w-24 overflow-hidden rounded-full bg-[#0066CC]/10">
              <UserAvatar
                firstName={firstName}
                lastName={lastName}
                avatarPath={profile?.avatar_path}
                className="h-24 w-24 text-2xl"
                imageClassName="h-24 w-24 rounded-full object-cover"
              />
              <button
                type="button"
                onClick={handleAvatarClick}
                onPointerDown={startAvatarPress}
                onPointerUp={cancelAvatarPress}
                onPointerLeave={cancelAvatarPress}
                onPointerCancel={cancelAvatarPress}
                onContextMenu={(event) => event.preventDefault()}
                disabled={isAvatarUploading}
                className="absolute inset-0 flex touch-manipulation select-none items-center justify-center bg-black/45 text-[12px] font-semibold text-white opacity-100 transition-opacity hover:bg-black/55 disabled:cursor-wait sm:opacity-0 sm:group-hover:opacity-100"
                title="Actualizar foto. Mantener presionado para verla."
                aria-label="Actualizar foto de perfil. Mantener presionado para verla."
              >
                {isAvatarUploading ? 'Subiendo...' : 'Actualizar'}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                className="sr-only"
              />
            </div>
            <p className="mt-4 max-w-full truncate text-base font-semibold text-[#1D1D1F]">
              {firstName || lastName ? `${firstName} ${lastName}` : 'Usuario'}
            </p>
            <p className="mt-0.5 max-w-full truncate text-[13px] text-[#86868B]">{profile?.email}</p>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200/70 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0066CC]/10 text-[#0066CC]">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1D1D1F]">Información personal</h3>
              <p className="text-[13px] text-[#86868B]">Estos datos se muestran dentro del sistema.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <TextInput label="Nombre" value={firstName} onChange={setFirstName} autoComplete="given-name" />
            <TextInput label="Apellidos" value={lastName} onChange={setLastName} autoComplete="family-name" />
            <TextInput label="Teléfono" value={phone} onChange={setPhone} autoComplete="tel" required={false} />
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">Correo</span>
              <input
                value={profile?.email || ''}
                disabled
                className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-[#86868B] outline-none"
              />
            </label>
          </div>

          {errorMessage && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mt-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {successMessage}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0066CC] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0057AD] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </section>
      </form>

      {preview && <MediaPreviewDialog preview={preview} onClose={() => setPreview(null)} />}
      {isPasswordDialogOpen && (
        <PasswordChangeDialog onClose={() => setIsPasswordDialogOpen(false)} onUpdatePassword={updatePassword} />
      )}
    </div>
  );
};

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
}

const TextInput = ({ label, value, onChange, autoComplete, required = true }: TextInputProps) => {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">{label}</span>
      <input
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15"
      />
    </label>
  );
};

interface PasswordChangeDialogProps {
  onClose: () => void;
  onUpdatePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

const PasswordChangeDialog = ({ onClose, onUpdatePassword }: PasswordChangeDialogProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (newPassword.length < 8) {
      setErrorMessage('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('La confirmación no coincide.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpdatePassword(currentPassword, newPassword);
      setSuccessMessage('Contraseña actualizada.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-lg"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0066CC]/10 text-[#0066CC] sm:h-10 sm:w-10">
              <KeyRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-[#1D1D1F]">Cambiar contraseña</h3>
              <p className="truncate text-[12px] text-[#86868B]">Usa 8 caracteres o más.</p>
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

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-3 sm:space-y-4">
            <PasswordField
              label="Contraseña actual"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <PasswordField
              label="Nueva contraseña"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirmar nueva contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          </div>

          {errorMessage && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              {successMessage}
            </div>
          )}
        </div>

        <div className="grid gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:flex sm:justify-end sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-[#1D1D1F] transition-colors hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 rounded-lg bg-[#0066CC] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0057AD] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}

const PasswordField = ({ label, value, onChange, autoComplete }: PasswordFieldProps) => {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-[#1D1D1F]">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15 sm:h-11"
        autoComplete={autoComplete}
        required
      />
    </label>
  );
};

interface MediaPreviewDialogProps {
  preview: MediaPreview;
  onClose: () => void;
}

const MediaPreviewDialog = ({ preview, onClose }: MediaPreviewDialogProps) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 px-3 py-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[#1D1D1F]">{preview.title}</h3>
            <p className="text-[12px] text-[#86868B]">Imagen</p>
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
          <img src={preview.url} alt="" className="mx-auto max-h-[calc(100vh-9rem)] w-auto max-w-full rounded-lg object-contain" />
        </div>
      </div>
    </div>
  );
};
