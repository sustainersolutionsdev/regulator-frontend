/**
 * RegionSelect - the Region field: Srinivas's region list with type-ahead and
 * "Other" (testing feedback, Oct 26), plus the US states when the Country is
 * the United States ("US", "USA", "United States"...; Oct 24 US, item 3).
 * Behaviour lives in OptionCombobox. Region stays optional.
 */
import { useMemo } from 'react';
import OptionCombobox from './OptionCombobox';
import { REGION_OPTIONS, US_STATES } from '../constants/regions';
import { countryCodes } from '../utils/countries';

export default function RegionSelect({ country, ...props }) {
  const isUS = countryCodes(country).includes('us');
  const choices = useMemo(() => (isUS ? [...US_STATES, ...REGION_OPTIONS] : REGION_OPTIONS), [isUS]);
  return (
    <OptionCombobox
      {...props}
      choices={choices}
      noun="region"
      nounPlural={isUS ? 'regions and US states' : 'regions'}
      otherPlaceholder="e.g. Middle East"
    />
  );
}
