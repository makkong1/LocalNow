import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RequestForm from '../components/RequestForm';
import type { CreateRequestBody } from '../types/api';

describe('RequestForm', () => {
  const mockSubmit = jest.fn();
  const defaultProps = {
    initialLat: 37.5665,
    initialLng: 126.978,
    onSubmit: mockSubmit,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disables submit button when required fields are empty', () => {
    const { getByTestId } = render(<RequestForm {...defaultProps} />);
    expect(getByTestId('submit-button')).toBeDisabled();
  });

  it('enables submit button when required fields are filled', () => {
    const { getByTestId } = render(<RequestForm {...defaultProps} />);
    fireEvent.changeText(getByTestId('description-input'), '영어 통역이 필요합니다');
    fireEvent.changeText(getByTestId('budget-input'), '30000');
    expect(getByTestId('submit-button')).not.toBeDisabled();
  });

  it('calls onSubmit with correct body when form is submitted', () => {
    const { getByTestId } = render(<RequestForm {...defaultProps} />);

    fireEvent.changeText(getByTestId('description-input'), '영어 통역이 필요합니다');
    fireEvent.changeText(getByTestId('budget-input'), '30000');
    fireEvent.press(getByTestId('submit-button'));

    expect(mockSubmit).toHaveBeenCalledTimes(1);
    const body: CreateRequestBody = mockSubmit.mock.calls[0][0];
    expect(body.description).toBe('영어 통역이 필요합니다');
    expect(body.budgetKrw).toBe(30000);
    expect(body.lat).toBe(37.5665);
    expect(body.lng).toBe(126.978);
    expect(typeof body.startAt).toBe('string');
    expect(body.durationMin).toBeGreaterThan(0);
    expect(['GUIDE', 'TRANSLATION', 'FOOD', 'EMERGENCY']).toContain(body.requestType);
  });

  it('disables submit button when isLoading is true', () => {
    const { getByTestId } = render(
      <RequestForm {...defaultProps} isLoading={true} />,
    );
    fireEvent.changeText(getByTestId('description-input'), '도움 요청');
    fireEvent.changeText(getByTestId('budget-input'), '20000');
    expect(getByTestId('submit-button')).toBeDisabled();
  });
});
