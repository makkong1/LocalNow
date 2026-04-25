import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import OnDutyToggle from '../components/OnDutyToggle';

import * as Location from 'expo-location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const mockRequestPermissions = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockGetPosition = Location.getCurrentPositionAsync as jest.Mock;

describe('OnDutyToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });
    mockGetPosition.mockResolvedValue({
      coords: { latitude: 37.5, longitude: 127.0 },
    });
  });

  it('calls onToggle(true, location) when switched on', async () => {
    const mockToggle = jest.fn();
    const { getByTestId } = render(
      <OnDutyToggle isOnDuty={false} onToggle={mockToggle} isLoading={false} />,
    );

    await act(async () => {
      fireEvent(getByTestId('duty-switch'), 'valueChange', true);
    });

    expect(mockToggle).toHaveBeenCalledWith(true, { lat: 37.5, lng: 127.0 });
  });

  it('calls onToggle(false) when switched off', async () => {
    const mockToggle = jest.fn();
    const { getByTestId } = render(
      <OnDutyToggle isOnDuty={true} onToggle={mockToggle} isLoading={false} />,
    );

    await act(async () => {
      fireEvent(getByTestId('duty-switch'), 'valueChange', false);
    });

    expect(mockToggle).toHaveBeenCalledWith(false);
  });

  it('shows alert and does not call onToggle when location permission is denied', async () => {
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const mockToggle = jest.fn();

    const { getByTestId } = render(
      <OnDutyToggle isOnDuty={false} onToggle={mockToggle} isLoading={false} />,
    );

    await act(async () => {
      fireEvent(getByTestId('duty-switch'), 'valueChange', true);
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(mockToggle).not.toHaveBeenCalled();
  });
});
