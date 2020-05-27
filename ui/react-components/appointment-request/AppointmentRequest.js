import {PROVIDER_RESPONSES} from "../constants";
import {cloneDeep, each, find, isUndefined, map} from "lodash";

const isActiveProvider = function (provider) {
    return provider.response !== PROVIDER_RESPONSES.CANCELLED;
};

const updateProviderResponse = function (updatedProviders, appointmentRequest) {
    each(appointmentRequest.providers, function (providerInAppointment) {
        if (isActiveProvider(providerInAppointment)) {
            const updatedProvider = find(updatedProviders, function (providerWithUpdatedResponse) {
                return providerWithUpdatedResponse.uuid === providerInAppointment.value;
            });
            if (!isUndefined(updatedProvider)) {
                providerInAppointment.response = updatedProvider.response;
            }
        }
    });
};

const updateAppointmentStatusAndProviderResponse = async function (appointmentDetails, appointmentRequest) {
    const {default: getUpdatedStatusAndProviderResponse} = await import('./AppointmentStatusHandler');
    // TODO: set current provider uuid // appointmentDetails.service
    let currentProviderUuid = "";//$scope.currentProvider.uuid;
    const allAppointmentDetails = cloneDeep(appointmentRequest);
    allAppointmentDetails.service = appointmentDetails.service.value;
    allAppointmentDetails.providers = map(appointmentRequest.providers, provider => ({
        response: provider.response,
        uuid: provider.value
    }));

    const updatedStatusAndProviderResponse = getUpdatedStatusAndProviderResponse(allAppointmentDetails,
        currentProviderUuid, [], false);
    appointmentRequest.status = updatedStatusAndProviderResponse.status;
    updateProviderResponse(updatedStatusAndProviderResponse.providers, appointmentRequest);
};


export default updateAppointmentStatusAndProviderResponse;