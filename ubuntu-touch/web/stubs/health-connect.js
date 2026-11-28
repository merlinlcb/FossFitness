// Ubuntu Touch has no Health Connect. Report it as unavailable so the app hides the feature.
const unavailable = async () => { throw new Error('Health Connect is not available on Ubuntu Touch'); };
export const SdkAvailabilityStatus = { SDK_UNAVAILABLE: 1, SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED: 2, SDK_AVAILABLE: 3 };
export const getSdkStatus = async () => SdkAvailabilityStatus.SDK_UNAVAILABLE;
export const initialize = async () => false;
export const getGrantedPermissions = async () => [];
export const requestPermission = unavailable;
export const readRecords = unavailable;
export const openHealthConnectSettings = () => {};
export default { getSdkStatus, initialize, getGrantedPermissions, requestPermission, readRecords, openHealthConnectSettings, SdkAvailabilityStatus };
