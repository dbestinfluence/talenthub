import StepDraftIcon from "./DraftIcon";
import StepQuotationIcon from "./QuotationIcon";
import StepRunningIcon from "./RunningIcon";
import StepAnalyticsIcon from "./AnalyticsIcon";
import StepInvoiceIcon from "./StepInvoiceIcon";

type Props = {
  step: string;
  className?: string;
  active?: boolean;
};

export default function TrackingStepIcon({
  step,
  className,
  active = false,
}: Props) {
  switch (step) {
    case "Draft":
      return <StepDraftIcon className={className} active={active} />;

    case "Quotation":
      return <StepQuotationIcon className={className} active={active} />;

    case "Running":
      return <StepRunningIcon className={className} active={active} />;

    case "Report":
      return <StepAnalyticsIcon className={className} active={active} />;

    case "Invoice":
      return <StepInvoiceIcon className={className} active={active} />;

    default:
      return null;
  }
}
