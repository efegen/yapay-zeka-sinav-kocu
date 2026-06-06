// KocAvatar — gradyan ışıltı avatarı (sparkle ikonlu). Handoff CoachAvatar'ın RN karşılığı.
import { Ionicons } from '@expo/vector-icons';
import { Gradyan } from './Gradyan';
import { GOLGE_AVATAR } from './tokens';

interface KocAvatarProps {
  size?: number;
  radius?: number;
  glow?: boolean;
}

export function KocAvatar({ size = 36, radius, glow = true }: KocAvatarProps) {
  const r = radius != null ? radius : Math.round(size * 0.33);
  return (
    <Gradyan
      style={[
        {
          width: size,
          height: size,
          borderRadius: r,
          alignItems: 'center',
          justifyContent: 'center',
        },
        glow ? GOLGE_AVATAR : null,
      ]}
    >
      <Ionicons name="sparkles" size={Math.round(size * 0.52)} color="#fff" />
    </Gradyan>
  );
}
