import {APPOINTMENT_STATUSES, PROVIDER_RESPONSES} from "../constants";
import {map, isEmpty, includes, cloneDeep, some} from "lodash";
window.Bahmni = window.Bahmni || {};
Bahmni.Appointments = Bahmni.Appointments || {};

const mapNewProvidersToGivenResponse = function (appointment, existingProvidersUuids, response) {
    return map(appointment.providers, function (provider) {
        if (includes(existingProvidersUuids, provider.uuid)) {
            return {uuid: provider.uuid, response: provider.response};
        } else {
            return {uuid: provider.uuid, response: response};
        }
    });
};

const isStatusRequested = function (status) {
    return status === APPOINTMENT_STATUSES.Requested;
};

const isStatusScheduled = function (status) {
    return status === APPOINTMENT_STATUSES.Scheduled;
};

const isNewAppointment = function (appointment) {
    return !appointment.uuid;
};

const getStatusForAppointment = function (appointment) {
    if (isNewAppointment(appointment) || isStatusRequested(appointment.status)) {
        return APPOINTMENT_STATUSES.Scheduled;
    } else {
        return appointment.status;
    }
};

const updateIfCurrentProviderInAppointment = function (statusAndProviderResponse, currentProviderUuid, appointment) {
    const clone = cloneDeep(statusAndProviderResponse);
    const isCurrentProviderInAppointment = some(statusAndProviderResponse.providers, provider => provider.uuid === currentProviderUuid);
    if (!isCurrentProviderInAppointment) return clone;

    clone.status = getStatusForAppointment(appointment);
    clone.providers = map(clone.providers, function (provider) {
        const response = (provider.uuid === currentProviderUuid) ?
            PROVIDER_RESPONSES.ACCEPTED : provider.response;
        return {uuid: provider.uuid, response: response};
    });
    return clone;
};

const updateIfRescheduled = function (statusAndProviderResponse, appointment, currentProviderUuid) {
    // in this case we don't keep the existing appointment status and responses
    //this is an special edit
    const clone = cloneDeep(statusAndProviderResponse);
    const isCurrentProviderInAppointment = some(clone.providers, provider => provider.uuid === currentProviderUuid);

    clone.status = isCurrentProviderInAppointment ? APPOINTMENT_STATUSES.Scheduled :
        APPOINTMENT_STATUSES.Requested;
    clone.providers = map(clone.providers, function (provider) {
        const response = (provider.uuid === currentProviderUuid) ?
            PROVIDER_RESPONSES.ACCEPTED : PROVIDER_RESPONSES.AWAITING;
        return {uuid: provider.uuid, response: response};
    });
    return clone;
};

const updateIfAtleastOneProviderHasAccepted = function (statusAndProviderResponse) {
    //this handles special cases like,
    //  when new providers are added to a no provider appointment
    //  when only accepted provider is removed from appointment appointment

    const clone = cloneDeep(statusAndProviderResponse);
    const hasAtleastOneAccept = some(clone.providers, function (provider) {
        return provider.response === PROVIDER_RESPONSES.ACCEPTED;
    });
    if (hasAtleastOneAccept) {
        if (isStatusRequested(clone.status)) {
            clone.status = APPOINTMENT_STATUSES.Scheduled;
        }
    } else {
        if (isStatusScheduled(clone.status)) {
            clone.status = APPOINTMENT_STATUSES.Requested;
        }
    }
    return clone;
};

const statusAndResponseForScheduledServices = function (appointment) {
    const statusAndProviderResponse = {};
    statusAndProviderResponse.status = isNewAppointment(appointment) ?
        APPOINTMENT_STATUSES.Scheduled : appointment.status;
    statusAndProviderResponse.providers = map(appointment.providers, function (provider) {
        return {uuid: provider.uuid, response: PROVIDER_RESPONSES.ACCEPTED};
    });
    return statusAndProviderResponse;
};

const statusAndResponseForRequestedServices = function (appointment, existingProvidersUuids) {
    const statusAndProviderResponse = {};
    statusAndProviderResponse.status = isNewAppointment(appointment) ?
        APPOINTMENT_STATUSES.Requested : appointment.status;

    statusAndProviderResponse.providers = mapNewProvidersToGivenResponse(appointment, existingProvidersUuids,
        PROVIDER_RESPONSES.AWAITING);
    return statusAndProviderResponse;
};

const getUpdatedStatusAndProviderResponse = function (appointment, currentProviderUuid, existingProvidersUuids, isRescheduled) {
    if (!isStatusRequested(appointment.service.initialAppointmentStatus)) {
        return statusAndResponseForScheduledServices(appointment);
    }
    if (isEmpty(appointment.providers)) {
        return {status: getStatusForAppointment(appointment), providers: []};
    }
    let statusAndProviderResponse = statusAndResponseForRequestedServices(appointment, existingProvidersUuids);

    statusAndProviderResponse = updateIfCurrentProviderInAppointment(statusAndProviderResponse, currentProviderUuid, appointment);
    statusAndProviderResponse = updateIfAtleastOneProviderHasAccepted(statusAndProviderResponse);

    if (isRescheduled) {
        statusAndProviderResponse = updateIfRescheduled(statusAndProviderResponse, appointment, currentProviderUuid);
    }
    return statusAndProviderResponse;
};

export default getUpdatedStatusAndProviderResponse;