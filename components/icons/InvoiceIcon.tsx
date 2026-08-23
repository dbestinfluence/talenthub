type IconProps = {
  className?: string;
};

export default function InvoiceIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 10 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M0.856269 12L0 11.1607L1.80428 9.42331H0.428134V8.2454H3.88379V11.573H2.66055V10.2626L0.856269 12ZM5.10703 11.7791V7.06748H0.214067V1.17791C0.214067 0.853988 0.333945 0.576785 0.5737 0.346307C0.813455 0.115828 1.10133 0.000392638 1.43731 0H6.33028L10 3.53374V10.6012C10 10.9252 9.88033 11.2026 9.64098 11.4334C9.40163 11.6643 9.11356 11.7795 8.77676 11.7791H5.10703ZM5.71865 4.1227H8.77676L5.71865 1.17791V4.1227Z"
        fill="currentColor"
      />
    </svg>
  );
}