type IconProps = {
  className?: string;
};

export default function CheckIcon({
  className = "",
}: IconProps) {
  return (
    <svg
      width="28"
      height="26"
      viewBox="0 0 28 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.5714 26C6.07593 26 0 20.1799 0 13C0 5.8201 6.07593 0 13.5714 0C21.0669 0 27.1429 5.8201 27.1429 13C27.1429 20.1799 21.0669 26 13.5714 26ZM11.9741 15.782L8.22157 12.1849L6.78571 13.5603L11.0186 17.6176C11.2731 17.8613 11.6183 17.9982 11.9781 17.9982C12.338 17.9982 12.6831 17.8613 12.9376 17.6176L21.0154 9.8826L19.5741 8.502L11.9741 15.782Z"
        fill="#009966"
      />
    </svg>
  );
}