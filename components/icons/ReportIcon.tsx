type IconProps = {
  className?: string;
};

export default function ReportIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 19 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M18.1919 0.75H0.75V5.48684H18.1919V0.75Z"
        fill="#FFBE4D"
      />
      <path
        d="M0.75 14.9724L6.0593 10.1171L8.92805 12.604L12.4352 9.43423L14.3887 11.1584"
        stroke="#FFBE4D"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.1919 5.15994V15.4231M0.75 5.15994V10.6863M4.6814 15.7499H18.1919"
        stroke="#FFBE4D"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}