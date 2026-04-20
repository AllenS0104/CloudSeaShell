/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
}));

jest.spyOn(global, 'fetch').mockResolvedValue({
  ok: true,
  json: async () => ({
    results: [
      {
        latitude: 39.9042,
        longitude: 116.4074,
        name: '北京',
        admin1: '北京市',
        country: '中国',
      },
    ],
  }),
} as Response);

jest.mock('react-native-webview', () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const React = require('react');
  const { View } = require('react-native');

  return {
    WebView: React.forwardRef((props: Record<string, unknown>, _ref: unknown) => React.createElement(View, props)),
  };
});

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
