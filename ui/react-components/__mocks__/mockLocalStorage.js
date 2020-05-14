import 'jest-localstorage-mock';

const testReactConstants = {
    "appointmentService": "/openmrs/ws/rest/v1/appointmentService",
    "searchPatientUrl": "/openmrs/ws/rest/v1/bahmnicore/search/patient",
    "servicesDefaultUrl": "/openmrs/ws/rest/v1/appointmentService/all/default",
    "providerUrl": "/openmrs/ws/rest/v1/provider",
    "providerParams": "v=custom:(display,person,uuid,retired,attributes:(attributeType:(display),value,voided))",
    "locationUrl": "/openmrs/ws/rest/v1/location",
    "specialityUrl": "/openmrs/ws/rest/v1/speciality/all",
    "appointmentSaveUrl": "/openmrs/ws/rest/v1/appointment",
    "appointmentsSaveUrl": "/openmrs/ws/rest/v1/appointments",
    "appointmentByUuidUrl": "/openmrs/ws/rest/v1/appointment/",
    "recurringAppointmentFetchUrl": "/openmrs/ws/rest/v1/recurring-appointments/",
    "recurringAppointmentsSaveUrl": "/openmrs/ws/rest/v1/recurring-appointments",
    "appointmentConflictsUrl": "/openmrs/ws/rest/v1/appointments/conflicts",
    "recurringAppointmentsConflictsUrl": "/openmrs/ws/rest/v1/recurring-appointments/conflicts",
    "i18nConfigPath": "/bahmni_config/openmrs/i18n/",
    "BAHMNI_CONFIG_URL": "/bahmni_config/openmrs/apps",
    "IMPLEMENTATION_CONFIG_URL": "/implementation_config/openmrs/apps",
    "locationTagName": "Appointment Location"
}

localStorage.setItem("reactConstants", JSON.stringify(testReactConstants));
