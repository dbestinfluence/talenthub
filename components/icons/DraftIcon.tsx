type IconProps = {
  className?: string;
  active?: boolean;
};

export default function DraftIcon({
  className = "",
  active = false,
}: IconProps) {
  return (
    <svg
      width="20"
      height="34"
      viewBox="0 0 20 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="33"
        rx="9.5"
        stroke={active ? "#EA580C" : "#111827"}
      />

      <path
        d="M11.665 10.5L15.5 14.4043V22.5996C15.5 22.854 15.4165 23.0585 15.2393 23.2393C15.0629 23.419 14.8675 23.5002 14.626 23.5H6.375C6.13336 23.5 5.9374 23.4182 5.76074 23.2383C5.58407 23.0582 5.50035 22.8545 5.5 22.5996V11.4004C5.5 11.1464 5.58357 10.9429 5.76074 10.7627C5.91603 10.6048 6.08556 10.5222 6.28711 10.5039L6.37598 10.5H11.665ZM5.875 23.0996H15.125V14.4004H11.6875V10.9004H5.875V23.0996Z"
        stroke={active ? "#EA580C" : "#111827"}
      />
    </svg>
  );
}