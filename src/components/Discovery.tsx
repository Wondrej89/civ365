import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { useI18n } from '../i18n/LocaleContext';
import {
  currentDiscoveries,
  newDiscoverySheets,
  discoverySettings,
  type Discovery as DiscoveryItem,
} from '../game/systems/discoveries';

const Context = createContext({
  items: new Map<string, DiscoveryItem>(),
  acknowledged: new Set<string>(),
  newSheets: new Set<string>(),
  paused: false,
});
export function DiscoveryProvider({ children }: { children: ReactNode }) {
  const { state, report } = useGame();
  const value = useMemo(() => {
    const items = currentDiscoveries(state);
    return {
      items: new Map(items.map((item) => [item.id, item])),
      acknowledged: new Set(state.discoveryProgress.acknowledgedItems),
      newSheets: new Set<string>(newDiscoverySheets(state, items)),
      paused: !!report,
    };
  }, [state, report]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useDiscoveryStatus = () => useContext(Context);

/** Preserve the original DOM element, layout and accessible control names. */
export function Discovery({
  discoveryId,
  as: Tag = 'div',
  className = '',
  children,
  elementRef,
  ...props
}: HTMLAttributes<HTMLElement> & {
  discoveryId: string;
  as?: 'div' | 'section' | 'article' | 'tr' | 'button' | 'span';
  elementRef?: (node: HTMLElement | null) => void;
}) {
  const { t: tr } = useI18n();
  const { items, acknowledged, paused } = useDiscoveryStatus();
  const item = items.get(discoveryId);
  const isNew = !!item && !acknowledged.has(discoveryId);
  const passive = item?.mode === 'passive';
  const element = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isNew || !passive || paused || !element.current) return;
    let visible = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const refresh = () => {
      cancel();
      if (visible && document.visibilityState === 'visible')
        timer = setTimeout(() => {
          if (
            visible &&
            document.visibilityState === 'visible' &&
            !gameStore.getSnapshot().report
          )
            gameStore.acknowledgeDiscovery(discoveryId);
        }, discoverySettings.readingMilliseconds);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible =
          entry.isIntersecting &&
          entry.intersectionRatio >= discoverySettings.visibleFraction;
        refresh();
      },
      { threshold: [0, discoverySettings.visibleFraction] },
    );
    observer.observe(element.current);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancel();
      observer.disconnect();
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [discoveryId, isNew, passive, paused]);
  function interact(target: EventTarget) {
    if (!isNew || passive || paused || !(target instanceof Element)) return;
    const control = target.closest(
      'button,input,select,textarea,a[href],summary,label',
    );
    if (!control || control.matches(':disabled')) return;
    if (
      control instanceof HTMLLabelElement &&
      control.control?.matches(':disabled')
    )
      return;
    gameStore.acknowledgeDiscovery(discoveryId);
  }
  return (
    <Tag
      {...props}
      ref={(node: HTMLElement | null) => {
        element.current = node;
        elementRef?.(node);
      }}
      className={`${className}${isNew ? ' is-new-discovery' : ''}`}
      data-discovery={discoveryId}
      data-discovery-new={isNew ? 'true' : undefined}
      aria-description={isNew ? tr('New content') : props['aria-description']}
      onClickCapture={(event) => {
        interact(event.target);
        props.onClickCapture?.(event);
      }}
      onChangeCapture={(event) => {
        interact(event.target);
        props.onChangeCapture?.(event);
      }}
    >
      {children}
    </Tag>
  );
}
