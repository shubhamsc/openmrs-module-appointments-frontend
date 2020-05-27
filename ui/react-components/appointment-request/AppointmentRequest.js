import {PROVIDER_RESPONSES} from "../constants";
import {cloneDeep, each, find, isUndefined, map} from "lodash";
import {isActiveProvider} from "../helper";

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

const updateAppointmentStatusAndProviderResponse = async function (appointmentDetails, appointmentRequest,
                                                                   currentProviderUuid, existingProvidersUuids, isRescheduled) {
    const {default: getUpdatedStatusAndProviderResponse} = await import('./AppointmentStatusHandler');
    const allAppointmentDetails = cloneDeep(appointmentRequest);
    allAppointmentDetails.service = appointmentDetails.service.value;
    allAppointmentDetails.providers = map(appointmentRequest.providers, provider => ({
        response: provider.response,
        uuid: provider.value
    }));

    const updatedStatusAndProviderResponse = getUpdatedStatusAndProviderResponse(allAppointmentDetails,
        currentProviderUuid, existingProvidersUuids, isRescheduled);
    appointmentRequest.status = updatedStatusAndProviderResponse.status;
    updateProviderResponse(updatedStatusAndProviderResponse.providers, appointmentRequest);
};


export default updateAppointmentStatusAndProviderResponse;