import React, {ReactElement} from 'react';
import renderer, {act} from 'react-test-renderer';

import {
  Card,
  EmptyState,
  PillButton,
  SectionHeader,
  StatTile,
  darkTokens,
} from '..';

function renderJSON(element: ReactElement) {
  let instance: renderer.ReactTestRenderer | undefined;

  act(() => {
    instance = renderer.create(element);
  });

  const json = instance?.toJSON();

  act(() => {
    instance?.unmount();
  });

  return json;
}

describe('RN design-token components', () => {
  it('renders Card children and variant props', () => {
    const tree = renderJSON(<Card variant="compact" tokens={darkTokens}>CloudSea</Card>);

    expect(tree).toBeTruthy();
  });

  it('renders SectionHeader props', () => {
    const tree = renderJSON(
      <SectionHeader eyebrow="PHOTO" title="附近机位" subtitle="推荐" tokens={darkTokens} />,
    );

    expect(JSON.stringify(tree)).toContain('附近机位');
  });

  it('renders EmptyState action props', () => {
    const onPress = jest.fn();
    const tree = renderJSON(
      <EmptyState
        icon="🔭"
        title="暂无观测记录"
        hint="去首页查看预测吧"
        buttonText="返回首页"
        onPress={onPress}
        tokens={darkTokens}
      />,
    );

    expect(JSON.stringify(tree)).toContain('返回首页');
  });

  it('renders StatTile props', () => {
    const tree = renderJSON(
      <StatTile icon="☁️" label="云量" value="42%" variant="stack" strong tokens={darkTokens} />,
    );

    expect(JSON.stringify(tree)).toContain('云量');
  });

  it('renders PillButton props', () => {
    const onPress = jest.fn();
    const tree = renderJSON(
      <PillButton icon="🖼️" label="生成海报" variant="ghost" onPress={onPress} tokens={darkTokens} />,
    );

    expect(JSON.stringify(tree)).toContain('生成海报');
  });
});
