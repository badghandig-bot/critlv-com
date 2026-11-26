/* Optional analytics configuration. A blank ID sends nothing to Google. */
window.CritAnalyticsConfig = Object.freeze({
  measurementId: '',
  canonicalOrigin: 'https://critnetworking.com',
  allowedHosts: ['critnetworking.com', 'www.critnetworking.com'],
  // Show a small opt-in prompt only after a real measurement ID is configured.
  promptForConsent: true,
  // Add only approved, non-personal campaign labels used in your marketing.
  // Unlisted utm_campaign values are discarded instead of sent to Analytics.
  allowedCampaigns: ['google-business-profile', 'wake-contractors', 'business-cards', 'referral-partners'],
});
