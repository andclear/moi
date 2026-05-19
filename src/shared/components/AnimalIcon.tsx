import { Icon, type IconName } from "animal-island-ui";

interface AnimalIconProps {
  name: IconName;
  size?: number | string;
  className?: string;
  bounce?: boolean;
}

export function AnimalIcon({ name, size = 24, className, bounce = true }: AnimalIconProps) {
  return <Icon name={name} size={size} className={className} bounce={bounce} />;
}
