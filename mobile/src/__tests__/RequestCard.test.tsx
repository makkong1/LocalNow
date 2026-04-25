import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import RequestCard from '../components/RequestCard';
import type { HelpRequestResponse } from '../types/api';

const baseRequest: HelpRequestResponse = {
  id: 1,
  travelerId: 10,
  requestType: 'GUIDE',
  lat: 37.5,
  lng: 127.0,
  description: '관광 가이드 요청합니다',
  startAt: new Date().toISOString(),
  durationMin: 60,
  budgetKrw: 30000,
  status: 'OPEN',
  createdAt: new Date().toISOString(),
};

describe('RequestCard', () => {
  it('calls onAccept with requestId when accept button is pressed', () => {
    const mockAccept = jest.fn();
    const { getByTestId } = render(
      <RequestCard request={baseRequest} onAccept={mockAccept} isAccepting={false} />,
    );
    fireEvent.press(getByTestId('accept-button'));
    expect(mockAccept).toHaveBeenCalledWith(baseRequest.id);
  });

  it('disables accept button when isAccepting is true', () => {
    const { getByTestId } = render(
      <RequestCard request={baseRequest} onAccept={jest.fn()} isAccepting={true} />,
    );
    expect(getByTestId('accept-button')).toBeDisabled();
  });

  it('shows "수락 완료" and disables button when isAccepted is true', () => {
    const { getByTestId, getByText } = render(
      <RequestCard request={baseRequest} onAccept={jest.fn()} isAccepting={false} isAccepted={true} />,
    );
    expect(getByText('수락 완료')).toBeTruthy();
    expect(getByTestId('accept-button')).toBeDisabled();
  });

  it('applies amber emphasis style for EMERGENCY type', () => {
    const emergencyRequest: HelpRequestResponse = { ...baseRequest, requestType: 'EMERGENCY' };
    const { getByTestId } = render(
      <RequestCard request={emergencyRequest} onAccept={jest.fn()} isAccepting={false} />,
    );
    const typeEl = getByTestId('request-type');
    const flatStyle = StyleSheet.flatten(typeEl.props.style as Parameters<typeof StyleSheet.flatten>[0]);
    expect(flatStyle.color).toBe('#f59e0b');
  });
});
