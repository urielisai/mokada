import { UserRound } from 'lucide-react';
import { storageService } from '../../lib/supabase/storage';
import { cn } from '../../utils/cn';

interface UserAvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  avatarPath?: string | null;
  className?: string;
  imageClassName?: string;
}

export const UserAvatar = ({ firstName, lastName, avatarPath, className, imageClassName }: UserAvatarProps) => {
  const avatarUrl = storageService.getPublicUrl('user-avatars', avatarPath || null);
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={cn('h-9 w-9 rounded-full object-cover', imageClassName || className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-[12px] font-semibold text-accent',
        className,
      )}
    >
      {initials || <UserRound className="h-4 w-4" />}
    </div>
  );
};
