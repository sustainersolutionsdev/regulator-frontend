/**
 * DomainSelect - the Domain field: Srinivas's 17 domains with type-ahead and
 * "Other" (Oct 24 meeting, item 2). Behaviour lives in OptionCombobox.
 */
import OptionCombobox from './OptionCombobox';
import { DOMAIN_OPTIONS } from '../constants/domains';

export default function DomainSelect(props) {
  return (
    <OptionCombobox
      {...props}
      choices={DOMAIN_OPTIONS}
      noun="domain"
      nounPlural="domains"
      otherPlaceholder="e.g. Water"
    />
  );
}
