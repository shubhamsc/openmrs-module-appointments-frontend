import PropTypes from "prop-types";
import React, {Fragment, useEffect, useState} from "react";
import {FormattedMessage, injectIntl} from "react-intl";
import {filter, isEqual} from "lodash";
import classNames from "classnames";
import {
    appointmentEditor,
    appointmentPlanContainer,
    dateHeading,
    recurringContainer,
    recurringContainerLeft,
    recurringContainerRight,
    searchFieldsContainer
} from "../AddAppointment/AddAppointment.module.scss";
import {conflictsPopup, customPopup} from "../CustomPopup/CustomPopup.module.scss";
import AppointmentEditorCommonFieldsWrapper
    from "../AppointmentEditorCommonFieldsWrapper/AppointmentEditorCommonFieldsWrapper.jsx";
import {getRecurringAppointment} from "../../api/recurringAppointmentsApi";
import {getAppointment} from "../../api/appointmentsApi";
import {getPatientForDropdown} from "../../mapper/patientMapper";
import moment from "moment";
import 'moment-timezone';
import {getDuration, getValidProviders} from "../../helper";
import {
    appointmentEndTimeProps,
    appointmentStartTimeProps,
    CANCEL_CONFIRMATION_MESSAGE_EDIT,
    MINUTES, PROVIDER_RESPONSES,
    RECURRENCE_TERMINATION_AFTER,
    RECURRENCE_TERMINATION_ON,
    RECURRING_APPOINTMENT_TYPE,
    SCHEDULED_APPOINTMENT_TYPE,
    SERVICE_ERROR_MESSAGE_TIME_OUT_INTERVAL,
    WALK_IN_APPOINTMENT_TYPE,
    weekRecurrenceType
} from "../../constants";
import AppointmentPlan from "../AppointmentPlan/AppointmentPlan.jsx";
import Label from "../Label/Label.jsx";
import {
    currentTimeSlot,
    dateText,
    editAppointment,
    recurringDetailsEdit,
    recurringEndDateContainer,
    recurringEndDateLabel,
    recurringTerminationDetails,
    weekDaySelector
} from './EditAppointment.module.scss'
import TimeSelector from "../TimeSelector/TimeSelector.jsx";
import InputNumber from "../InputNumber/InputNumber.jsx";
import ButtonGroup from "../ButtonGroup/ButtonGroup.jsx";
import {getSelectedWeekDays, getWeekDays, selectWeekDays} from "../../services/WeekDaysService/WeekDaysService";
import AppointmentNotes from "../AppointmentNotes/AppointmentNotes.jsx";
import AppointmentEditorFooter from "../AppointmentEditorFooter/AppointmentEditorFooter.jsx";
import {getProviderDropDownOptions} from "../../mapper/providerMapper";
import CalendarPicker from "../CalendarPicker/CalendarPicker.jsx";
import AppointmentDatePicker from "../DatePicker/DatePicker.jsx";
import {capitalize} from "lodash/string";
import CustomPopup from "../CustomPopup/CustomPopup.jsx";
import Conflicts from "../Conflicts/Conflicts.jsx";
import {
    getAppointmentConflicts,
    getRecurringAppointmentsConflicts,
    saveAppointment,
    updateRecurring
} from "../../services/AppointmentsService/AppointmentsService";
import {getDateTime, isStartTimeBeforeEndTime} from "../../utils/DateUtil";
import UpdateSuccessModal from "../SuccessModal/UpdateSuccessModal.jsx";
import UpdateConfirmationModal from "../UpdateConfirmationModal/UpdateConfirmationModal.jsx";
import {getComponentsDisableStatus} from "./ComponentsDisableStatus";
import ErrorMessage from "../ErrorMessage/ErrorMessage.jsx";
import {getErrorTranslations} from "../../utils/ErrorTranslationsUtil";
import {AppContext} from "../AppContext/AppContext";
import updateAppointmentStatusAndProviderResponse from "../../appointment-request/AppointmentRequest";

const EditAppointment = props => {

    const {appConfig, appointmentUuid, isRecurring, intl} = props;

    const {setViewDate} = React.useContext(AppContext);

    const [errors, setErrors] = useState({
        serviceError: false,
        appointmentDateError: false,
        endDateError: false,
        occurrencesError: false,
        startTimeError: false,
        endTimeError: false,
        recurrencePeriodError: false,
        startTimeBeforeEndTimeError: false
    });

    const initialAppointmentState = {
        patient: undefined,
        providers: [],
        service: undefined,
        serviceType: undefined,
        location: undefined,
        speciality: undefined,
        appointmentDate: undefined,
        startTime: undefined,
        endTime: undefined,
        appointmentKind: undefined,
        appointmentType: isRecurring === 'true' ? RECURRING_APPOINTMENT_TYPE : undefined,
        status: undefined,
        recurringEndDate: undefined,
        notes: undefined,
        recurrenceType: undefined,
        occurrences: undefined,
        period: undefined,
        weekDays: undefined,
        endDateType: undefined
    };

    const [appointmentDetails, setAppointmentDetails] = useState(initialAppointmentState);
    const [conflicts, setConflicts] = useState();
    const [showUpdateConfirmPopup, setShowUpdateConfirmPopup] = useState(false);
    const [showUpdateSuccessPopup, setShowUpdateSuccessPopup] = useState(false);
    const [currentStartTime, setCurrentStartTime] = useState();
    const [currentEndTime, setCurrentEndTime] = useState();
    const [originalAppointmentDate, setOriginalAppointmentDate] = useState(undefined);
    const [originalRecurringEndDate, setOriginalRecurringEndDate] = useState(undefined);
    const [originalOccurrences, setOriginalOccurrences] = useState(undefined);
    const [applyForAll, setApplyForAll] = useState(false);
    const [serviceErrorMessage, setServiceErrorMessage] = useState('');
    const [existingProvidersUuids, setExistingProvidersUuids] = useState([]);
    const [appointmentTimeBeforeEdit, setAppointmentTimeBeforeEdit] = useState({});

    const isRecurringAppointment = () => appointmentDetails.appointmentType === RECURRING_APPOINTMENT_TYPE;
    const isWalkInAppointment = () => appointmentDetails.appointmentType === WALK_IN_APPOINTMENT_TYPE;
    const [componentsDisableStatus, setComponentsDisableStatus] = useState({});

    const errorTranslations = getErrorTranslations(intl);

    const updateErrorIndicators = errorIndicators => setErrors(prevErrors => {
        return {...prevErrors, ...errorIndicators}
    });

    const isActiveProvider = function (provider) {
        return provider.response !== PROVIDER_RESPONSES.CANCELLED;
    };

    const updateAppointmentDetails = modifiedAppointmentDetails => setAppointmentDetails(prevAppointmentDetails => {
        let appointmentTimeBeforeEdit = {
            date: modifiedAppointmentDetails.appointmentDate,
            startTime: modifiedAppointmentDetails.startTime,
            endTime: modifiedAppointmentDetails.endTime,
        };
        setAppointmentTimeBeforeEdit(appointmentTimeBeforeEdit);
        let existingProvidersUuids = filter(prevAppointmentDetails.providers, isActiveProvider)
            .map(provider => provider.uuid);
        setExistingProvidersUuids(existingProvidersUuids);
        return {...prevAppointmentDetails, ...modifiedAppointmentDetails}
    });

    //TODO To be checked if can be moved to common place
    const endTimeBasedOnService = (time, service, serviceType) => {
        const currentTime = moment(time);
        const duration = getDuration(service, serviceType);
        currentTime.add(duration, MINUTES);
        if (time) {
            updateAppointmentDetails({endTime: currentTime});
            updateErrorIndicators({endTimeError: false});
        }
    };

    const saveAppointments = () => {
        if (isRecurringAppointment()) {
            updateAllAppointments(getRecurringAppointmentRequest(applyForAll)).then();
        } else {
            save(getAppointmentRequest()).then();
        }
    };

    const updateSuccessPopup = <CustomPopup style={customPopup} popupContent={<UpdateSuccessModal
        updateSeries={appointmentDetails.appointmentType === RECURRING_APPOINTMENT_TYPE && applyForAll}/>}/>;

    const updateConfirmPopup = <CustomPopup style={customPopup} onClose={() => setShowUpdateConfirmPopup(false)}
                                            popupContent={
                                                <UpdateConfirmationModal
                                                    updateSeries={appointmentDetails.appointmentType === RECURRING_APPOINTMENT_TYPE && applyForAll}
                                                    save={saveAppointments}/>}/>;

    const getAppointmentRequest = () => {
        let appointment = {
            uuid: appointmentUuid,
            patientUuid: appointmentDetails.patient && appointmentDetails.patient.value.uuid,
            serviceUuid: appointmentDetails.service && appointmentDetails.service.value.uuid,
            serviceTypeUuid: appointmentDetails.serviceType && appointmentDetails.serviceType.value &&
                appointmentDetails.serviceType.value.uuid,
            startDateTime: getDateTime(appointmentDetails.appointmentDate, appointmentDetails.startTime),
            endDateTime: getDateTime(appointmentDetails.appointmentDate, appointmentDetails.endTime),
            providers: getValidProviders(appointmentDetails.providers),
            locationUuid: appointmentDetails.location && appointmentDetails.location.value && appointmentDetails.location.value.uuid,
            appointmentKind: appointmentDetails.appointmentKind,
            status: appointmentDetails.status,
            comments: appointmentDetails.notes
        };
        if (!appointment.serviceTypeUuid || appointment.serviceTypeUuid.length < 1)
            delete appointment.serviceTypeUuid;
        return appointment;
    };

    const getRecurringAppointmentRequest = (applyForAllInd) => {
        return {
            appointmentRequest: getAppointmentRequest(),
            recurringPattern: getRecurringPattern(),
            applyForAll: applyForAllInd,
            timeZone: moment.tz.guess()
        };
    };

    const getRecurringPattern = () => {
        const recurringPattern = {
            type: appointmentDetails.recurrenceType,
            period: appointmentDetails.period
        };
        appointmentDetails.endDateType === "After" ? recurringPattern.frequency = appointmentDetails.occurrences : recurringPattern.endDate = appointmentDetails.recurringEndDate;
        if (isWeeklyRecurringAppointment()) {
            recurringPattern.daysOfWeek = getSelectedWeekDays(appointmentDetails.weekDays);
        }
        return recurringPattern;
    };

    const isWeeklyRecurringAppointment = () => appointmentDetails.recurrenceType === weekRecurrenceType;

    const setServiceErrorMessageFromResponse = response => {
        response.error && response.error.message ? setServiceErrorMessage(response.error.message)
            : setServiceErrorMessage(errorTranslations.unexpectedServiceErrorMessage);
    };

    const resetServiceErrorMessage = () => {
        setTimeout(function () {
            setServiceErrorMessage('');
        }, SERVICE_ERROR_MESSAGE_TIME_OUT_INTERVAL);
    };

    const checkAndSave = async () => {
        if (isValidAppointment()) {
            const appointment = getAppointmentRequest();
            const response = await getAppointmentConflicts(appointment);
            const status = response.status;
            if (status === 204) {
                setShowUpdateConfirmPopup(true);
            } else if (status === 200) {
                setConflicts(response.data);
            } else if (response.data && response.data.error) {
                setConflicts(undefined);
                setServiceErrorMessageFromResponse(response.data);
                resetServiceErrorMessage();
            }
        }
    };

    const setViewDateAndShowSuccessPopup = startDate => {
        setViewDate(startDate.startOf('day').toDate());
        setShowUpdateSuccessPopup(true);
    };

    const isRescheduled = function (appointmentTimeBeforeEdit) {
        if (!moment(appointmentDetails.appointmentDate).isSame(moment(appointmentTimeBeforeEdit.date))) {
            return true;
        }
        const newStart = moment(appointmentDetails.startTime, 'hh:mm a');
        const previousStart = moment(appointmentTimeBeforeEdit.startTime, 'hh:mm a');
        const newEnd = moment(appointmentDetails.endTime, 'hh:mm a');
        const previousEnd = moment(appointmentTimeBeforeEdit.endTime, 'hh:mm a');

        const isSameStart = newStart.isSame(previousStart, 'minutes');
        const isSameEnd = newEnd.isSame(previousEnd, 'minutes');
        return !(isSameStart && isSameEnd);
    };

    const checkAndUpdateAppointmentStatus = async function (appointmentRequest, isRecurring) {
        if (isRescheduled(appointmentTimeBeforeEdit)){
            const appointmentRequestData = isRecurring ? appointmentRequest.appointmentRequest : appointmentRequest;
            await updateAppointmentStatusAndProviderResponse(appointmentDetails, appointmentRequestData);
        }
    };

    const save = async appointmentRequest => {
        if (appConfig.enableAppointmentRequests) {
            await checkAndUpdateAppointmentStatus(appointmentRequest, false);
        }
        const response = await saveAppointment(appointmentRequest);
        const status = response.status;
        if (status === 200) {
            setConflicts(undefined);
            setShowUpdateConfirmPopup(false);
            setViewDateAndShowSuccessPopup(appointmentDetails.appointmentDate);
        } else if (response.data && response.data.error) {
            setConflicts(undefined);
            setServiceErrorMessageFromResponse(response.data);
            resetServiceErrorMessage();
        }
    };

    const updateAllAppointments = async recurringAppointmentRequest => {
        if (appConfig.enableAppointmentRequests) {
            await checkAndUpdateAppointmentStatus(recurringAppointmentRequest, true);
        }
        const response = await updateRecurring(recurringAppointmentRequest);
        const status = response.status;
        if (status === 200) {
            setConflicts(undefined);
            setShowUpdateConfirmPopup(false);
            setViewDateAndShowSuccessPopup(appointmentDetails.appointmentDate);
        } else if (response.data && response.data.error) {
            setConflicts(undefined);
            setServiceErrorMessageFromResponse(response.data);
            resetServiceErrorMessage();
        }
    };

    const checkAndUpdateRecurringAppointments = async (applyForAllInd) => {
        if (isValidRecurringAppointment()) {
            const recurringRequest = getRecurringAppointmentRequest(applyForAllInd);
            const response = applyForAllInd ? await getRecurringAppointmentsConflicts(recurringRequest) :
                await getAppointmentConflicts(recurringRequest.appointmentRequest);
            const status = response.status;
            if (status === 204) {
                setShowUpdateConfirmPopup(true);
            } else if (status === 200) {
                setConflicts(response.data);
            } else if (response.data && response.data.error) {
                setConflicts(undefined);
                setServiceErrorMessageFromResponse(response.data);
                resetServiceErrorMessage();
            }
        }
    };


    const isValidAppointment = () => {
        const startTimeBeforeEndTime = isStartTimeBeforeEndTime(appointmentDetails.startTime, appointmentDetails.endTime);
        updateCommonErrorIndicators(startTimeBeforeEndTime);
        updateErrorIndicators({appointmentDateError: !appointmentDetails.appointmentDate});
        return appointmentDetails.service && appointmentDetails.appointmentDate && appointmentDetails.startTime && appointmentDetails.endTime && startTimeBeforeEndTime;
    };

    const updateCommonErrorIndicators = (startTimeBeforeEndTime) => updateErrorIndicators({
        serviceError: !appointmentDetails.service,
        startTimeError: !appointmentDetails.startTime,
        endTimeError: !appointmentDetails.endTime,
        startTimeBeforeEndTimeError: !startTimeBeforeEndTime,
        appointmentDateError: !appointmentDetails.appointmentDate
    });

    const isValidRecurringAppointment = () => {
        const startTimeBeforeEndTime = isStartTimeBeforeEndTime(appointmentDetails.startTime, appointmentDetails.endTime);

        updateCommonErrorIndicators(startTimeBeforeEndTime);
        updateErrorIndicators({
            recurrencePeriodError: !appointmentDetails.period || appointmentDetails.period < 1
        });
        if (appointmentDetails.endDateType === RECURRENCE_TERMINATION_ON) {
            updateErrorIndicators({
                endDateError: !appointmentDetails.recurringEndDate
            })
        } else {
            updateErrorIndicators({
                occurrencesError: !appointmentDetails.occurrences || appointmentDetails.occurrences < 1
            })
        }
        return appointmentDetails.service && appointmentDetails.startTime && appointmentDetails.endTime && startTimeBeforeEndTime
            && appointmentDetails.appointmentDate && isValidEndDate();
    };

    const isValidEndDate = () => appointmentDetails.recurringEndDate || (appointmentDetails.occurrences && appointmentDetails.occurrences > 0);

    const generateAppointmentDetails = async (callback) => {
        const appointment = isRecurringAppointment()
            ? await getRecurringAppointment(appointmentUuid) : await getAppointment(appointmentUuid);
        const appointmentResponse = isRecurringAppointment()
            ? (appointment && appointment.data && appointment.data.appointmentDefaultResponse) || undefined
            : (appointment && appointment.data) || undefined;
        const recurringPattern = isRecurringAppointment()
            ? (appointment && appointment.data && appointment.data.recurringPattern) || undefined : undefined;
        if (appointmentResponse) {
            setOriginalAppointmentDate(moment(new Date(appointmentResponse.startDateTime)));
            updateAppointmentDetails({
                patient: getPatientForDropdown(appointmentResponse.patient),
                providers: getProviderDropDownOptions(appointmentResponse.providers),
                service: {label: appointmentResponse.service.name, value: appointmentResponse.service},
                serviceType: appointmentResponse.serviceType ? {label: appointmentResponse.serviceType.name, value: appointmentResponse.serviceType} : undefined,
                location: appointmentResponse.location ? {label: appointmentResponse.location.name, value: appointmentResponse.location} : undefined,
                speciality: appointmentResponse.service.speciality.uuid ? {label: appointmentResponse.service.speciality.name, value: appointmentResponse.service.speciality} : undefined,
                startTime: moment(new Date(appointmentResponse.startDateTime)),
                endTime: moment(new Date(appointmentResponse.endDateTime)),
                notes: appointmentResponse.comments,
                appointmentDate: moment(new Date(appointmentResponse.startDateTime)),
                appointmentKind: appointmentResponse.appointmentKind,
                status: appointmentResponse.status,
                appointmentType: isRecurring === 'true' ? RECURRING_APPOINTMENT_TYPE :
                    appointmentResponse.appointmentKind === WALK_IN_APPOINTMENT_TYPE ? WALK_IN_APPOINTMENT_TYPE : undefined
            });
            setCurrentStartTime(moment(new Date(appointmentResponse.startDateTime)).format('hh:mm a'));
            setCurrentEndTime(moment(new Date(appointmentResponse.endDateTime)).format('hh:mm a'));
            if (isRecurringAppointment()) {
                setOriginalRecurringEndDate(recurringPattern.endDate && moment(new Date(recurringPattern.endDate)));
                setOriginalOccurrences(recurringPattern.frequency);
                updateAppointmentDetails({
                    recurrenceType: recurringPattern.type,
                    recurringEndDate: recurringPattern.endDate && moment(new Date(recurringPattern.endDate)),
                    occurrences: recurringPattern.frequency,
                    period: recurringPattern.period,
                    weekDays: recurringPattern.daysOfWeek && selectWeekDays(getWeekDays(appConfig && appConfig.startOfWeek), recurringPattern.daysOfWeek),
                    endDateType: recurringPattern.endDate ? RECURRENCE_TERMINATION_ON : RECURRENCE_TERMINATION_AFTER
                });
            }
        }
        callback(appointmentResponse);
    };

    const isStartDateModified = () => isDateModified(originalAppointmentDate, appointmentDetails.appointmentDate);

    const isEndDateModified = () => isDateModified(originalRecurringEndDate, appointmentDetails.recurringEndDate);

    const isDateModified = (originalDate, modifiedDate) => !isEqual(moment(originalDate).format('DMYYYY'), moment(modifiedDate).format('DMYYYY'));

    const isOccurrencesModified = () => originalOccurrences !== appointmentDetails.occurrences;

    const isApplicableForAll = () => {
       return  !(isStartDateModified() || isEndDateModified() || isOccurrencesModified())
    };

    const updateAppointments = (applyForAllInd) => {
        if (isRecurringAppointment()) {
            if (applyForAllInd === undefined) {
                applyForAllInd = !isStartDateModified();
            }
            setApplyForAll(applyForAllInd);
            checkAndUpdateRecurringAppointments(applyForAllInd).then();
        } else {
            checkAndSave().then();
        }
    };

    useEffect(() => {
        const setDisableStatus = (appointmentResponse) => setComponentsDisableStatus(getComponentsDisableStatus(appointmentResponse,
            appConfig && appConfig.isServiceOnAppointmentEditable));
        generateAppointmentDetails(setDisableStatus).then();
    }, [appConfig]);

    return (<Fragment>
        <div data-testid="appointment-editor"
             className={classNames(appointmentEditor, editAppointment, appointmentDetails.appointmentType === RECURRING_APPOINTMENT_TYPE ? isRecurring : '')}>
            <AppointmentEditorCommonFieldsWrapper appointmentDetails={appointmentDetails} errors={errors}
                                                  updateErrorIndicators={updateErrorIndicators}
                                                  endTimeBasedOnService={endTimeBasedOnService}
                                                  updateAppointmentDetails={updateAppointmentDetails}
                                                  appConfig={appConfig}
                                                  componentsDisableStatus={componentsDisableStatus}/>
            <div className={classNames(searchFieldsContainer)} data-testid="recurring-plan-checkbox">
                <div className={classNames(appointmentPlanContainer)}>
                    <AppointmentPlan isEdit={true} appointmentType={appointmentDetails.appointmentType}
                                     onChange={(e) => e.target.name === WALK_IN_APPOINTMENT_TYPE ?
                                         updateAppointmentDetails({
                                             appointmentType: isWalkInAppointment()
                                                 ? undefined : WALK_IN_APPOINTMENT_TYPE,
                                             appointmentKind: isWalkInAppointment()
                                             ? SCHEDULED_APPOINTMENT_TYPE : WALK_IN_APPOINTMENT_TYPE
                                         }) : undefined
                                     }
                                    isRecurringDisabled={componentsDisableStatus.recurring}
                                    isWalkInDisabled={componentsDisableStatus.walkIn}/>
                </div>
            </div>
            <div className={classNames(recurringContainer)}>
                <div className={classNames(recurringContainerLeft)}>
                    <div data-testid="date-selector">
                        <div className={classNames(dateHeading)}><Label translationKey='CHANGE_DATE_TO_LABEL'
                                                                        defaultValue={`Change ${moment(originalAppointmentDate).format('Do MMM')} to`}/></div>
                        <AppointmentDatePicker
                            onChange={date => {
                                updateAppointmentDetails({appointmentDate: date});
                                updateErrorIndicators({appointmentDateError: !date});
                            }}
                            value={appointmentDetails.appointmentDate}
                            minDate={moment()}
                            isDisabled={componentsDisableStatus.startDate}/>
                        <ErrorMessage message={errors.appointmentDateError ? errorTranslations.dateErrorMessage : undefined}/>
                    </div>
                    <div>
                        <div className={classNames(dateHeading)}>
                            <Label translationKey="CURRENT_TIME_SLOT_LABEL" defaultValue="Current time slot"/>
                        </div>
                        <div className={classNames(currentTimeSlot)}>
                            <span>{currentStartTime}</span>
                            <span> to </span>
                            <span>{currentEndTime}</span>
                        </div>
                        <div className={classNames(dateHeading)}>
                            <Label translationKey="APPOINTMENT_TIME_LABEL" defaultValue="Choose a time slot"/>
                        </div>
                        <div data-testid="start-time-selector">
                            <TimeSelector {...appointmentStartTimeProps(appointmentDetails.startTime)}
                                          onChange={time => {
                                              updateAppointmentDetails({startTime: time});
                                              endTimeBasedOnService(time, appointmentDetails.service && appointmentDetails.service.value,
                                                  appointmentDetails.serviceType && appointmentDetails.serviceType.value);
                                              updateErrorIndicators({startTimeError: !time});
                                          }}
                                          isDisabled={componentsDisableStatus.time}/>
                            <ErrorMessage message={errors.startTimeError ? errorTranslations.timeErrorMessage : undefined}/>
                        </div>
                        <div data-testid="end-time-selector">
                            <TimeSelector {...appointmentEndTimeProps(appointmentDetails.endTime)}
                                          onChange={time => {
                                              updateAppointmentDetails({endTime: time});
                                              updateErrorIndicators({
                                                  startTimeBeforeEndTimeError: !isStartTimeBeforeEndTime(appointmentDetails.startTime, time),
                                                  endTimeError: !time
                                              });
                                          }}
                                          isDisabled={componentsDisableStatus.time} />
                            <ErrorMessage message={errors.endTimeError ? errorTranslations.timeErrorMessage : undefined}/>
                        </div>
                        <ErrorMessage
                            message={appointmentDetails.startTime && appointmentDetails.endTime && errors.startTimeBeforeEndTimeError ? errorTranslations.startTimeLessThanEndTimeMessage : undefined}/>
                    </div>
                    {isRecurringAppointment() ?
                        <div className={classNames(recurringDetailsEdit)}>
                            <div>
                                <div className={classNames(dateHeading)}>
                                    <Label translationKey="REPEATS_EVERY_LABEL" defaultValue="Repeats every"/>
                                </div>
                                <div class={classNames(recurringTerminationDetails)}>
                                    <span>{moment.localeData().ordinal(appointmentDetails.period)} &nbsp; {isWeeklyRecurringAppointment()
                                        ? <Label translationKey="WEEK_LABEL" defaultValue="Week"/>
                                        : <Label translationKey="DAY_LABEL" defaultValue="Day"/>}</span>
                                </div>
                                <div className={classNames(weekDaySelector)}>
                                    {isWeeklyRecurringAppointment()
                                        ? <ButtonGroup buttonsList={appointmentDetails.weekDays}/>
                                        : undefined}
                                </div>
                            </div>
                            {appointmentDetails.endDateType === RECURRENCE_TERMINATION_AFTER
                                ? (<div>
                                    <div className={classNames(dateHeading)}>
                                        <Label translationKey="NUMBER_OF_OCCURRENCE_LABEL"
                                               defaultValue="# of occurrences"/>
                                    </div>
                                    <InputNumber
                                        onChange={value => {
                                            updateAppointmentDetails({occurrences: value});
                                            updateErrorIndicators({occurrencesError: !value || value < 1});
                                        }}
                                        defaultValue={appointmentDetails.occurrences}
                                        isDisabled={componentsDisableStatus.occurrences} />
                                    <Label translationKey="OCCURRENCES_LABEL" defaultValue="Occurrences"/>
                                    <ErrorMessage message={errors.occurrencesError ? errorTranslations.occurrencesErrorMessage : undefined}/>

                                </div>)
                                : (<div className={classNames(recurringEndDateContainer)}>
                                    <div className={classNames(dateHeading)}>
                                        <Label translationKey="NEW_END_DATE_LABEL" defaultValue="Series ends on"/>
                                    </div>
                                    <div class={classNames(recurringTerminationDetails)}>
                                        <span className={classNames(recurringEndDateLabel)}>
                                            <span>{moment(appointmentDetails.recurringEndDate).format("Do MMMM YYYY")}
                                            </span>
                                            <span className={classNames(dateText)}>
                                                {appointmentDetails.recurringEndDate
                                                    ? capitalize(moment(appointmentDetails.recurringEndDate).format("dddd"))
                                                    : <FormattedMessage id="INVALID_DAY" defaultMessage="Invalid day"/>}
                                            </span>
                                        </span>
                                        <span>
                                            <CalendarPicker
                                                onChange={date => {
                                                    updateAppointmentDetails({recurringEndDate: date})
                                                    if (date)
                                                        updateErrorIndicators({endDateError: !date});
                                                }}
                                                date={appointmentDetails.recurringEndDate}
                                                isDisabled={componentsDisableStatus.endDate}
                                                minDate={moment()}/>
                                        </span>
                                    </div>
                                    <ErrorMessage message={errors.endDateError ? errorTranslations.dateErrorMessage : undefined}/>
                                </div>)}
                        </div> : undefined}
                </div>
                <div className={classNames(recurringContainerRight)}>
                    <div className={classNames(dateHeading)}><Label translationKey="APPOINTMENT_NOTES"
                                                                    defaultValue="Notes"/></div>
                    <AppointmentNotes value={appointmentDetails.notes} onChange={(event) => updateAppointmentDetails({notes: event.target.value})}/>
                </div>
            </div>
            <AppointmentEditorFooter
                errorMessage={serviceErrorMessage}
                checkAndSave={applyForAllInd => updateAppointments(applyForAllInd)}
                isEdit={true}
                isOptionsRequired={isRecurringAppointment() && isApplicableForAll()}
                disableUpdateButton={isStartDateModified() && (isEndDateModified() || isOccurrencesModified())}
                cancelConfirmationMessage={CANCEL_CONFIRMATION_MESSAGE_EDIT}
            />
            {conflicts &&
            <CustomPopup style={conflictsPopup} open={true}
                         closeOnDocumentClick={false}
                         closeOnEscape={true}
                         onClose={() => setConflicts(undefined)}
                         popupContent={<Conflicts saveAnyway={saveAppointments}
                                                  modifyInformation={() => setConflicts(undefined)}
                                                  conflicts={conflicts} service={appointmentDetails.service}/>}/>}
            {showUpdateSuccessPopup ? React.cloneElement(updateSuccessPopup, {
                open: true,
                closeOnDocumentClick: false,
                closeOnEscape: false
            }) : undefined}

            {showUpdateConfirmPopup ? React.cloneElement(updateConfirmPopup, {
                open: true,
                closeOnDocumentClick: true,
                closeOnEscape: true
            }) : undefined}

        </div>
    </Fragment>);
};

EditAppointment.propTypes = {
    intl: PropTypes.object.isRequired,
    appConfig: PropTypes.object,
    appointmentUuid: PropTypes.string.isRequired,
    isRecurring: PropTypes.string.isRequired
};

export default injectIntl(EditAppointment);
