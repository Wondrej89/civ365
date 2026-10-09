import { useI18n } from '../i18n/LocaleContext';
import { useEffect, useRef } from 'react';
import {
  Plus,
  Users,
  ArrowDown,
  ArrowUpRight,
  LockKeyhole,
  RotateCcw,
} from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { gameStore } from '../game/store';
import { resources } from '../game/content/resources';
import {
  getPopulationFootprint,
  idlePopulation,
  ownedUnits,
  productionChains,
  unitStatus,
  unitById,
  unitCosts,
  maxCreatable,
  creationBlockReason,
} from '../game/engine/units';
import {
  populationCost,
  productionPerSecond,
  unitProduction,
  upgradePreview,
} from '../game/engine/production';
import { D } from '../game/utils/numbers';
import type {
  GameState,
  ProductionUnitDefinition,
  GameAction,
} from '../game/types';
import { ResourceIcon } from './common';
import { useWorkbookNavigation } from './navigation';
import { capacityReached } from '../game/engine/settlements';
import {
  productionPopulation,
  militaryPopulation,
} from '../game/engine/population-accounting';

export function GrowButton() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame(),
    cost = populationCost(state),
    affordable = state.resources.food.gte(cost),
    capped = capacityReached(state);
  return (
    <button
      className="button grow-button"
      disabled={!affordable || capped}
      title={
        capped
          ? tr(
              'Population capacity reached. Expand your settlements or acquire more territory.',
            )
          : affordable
            ? tr('Welcome one more person')
            : tr('Need {0} more Food', {
                '0': formatNumber(cost.sub(state.resources.food)),
              })
      }
      onClick={() => gameStore.dispatch({ type: 'grow' })}
    >
      <Users size={16} />
      <span>
        {tr('Grow Population')}
        <small>
          {formatNumber(cost)} {tr('Food')}
          {capped && tr(' · Population capacity reached.')}
          {!affordable &&
            tr(' · need {0} more', {
              '0': formatNumber(cost.sub(state.resources.food)),
            })}
        </small>
      </span>
      <Plus size={16} />
    </button>
  );
}
function ProductionValues({
  values,
  signed = false,
}: {
  values: Record<string, ReturnType<typeof D>>;
  signed?: boolean;
}) {
  const { formatNumber, t: tr } = useI18n();

  return (
    <>
      {Object.entries(values).map(([id, amount]) => (
        <span className="chain-production-value" key={id}>
          {signed && amount.gte(0) ? '+' : ''}
          {formatNumber(amount)}{' '}
          <small>
            {tr(resources.find((r) => r.id === id)?.name ?? '') || id}
            {tr('/s')}
          </small>
        </span>
      ))}
    </>
  );
}
function UnitCard({
  unit,
  state,
}: {
  unit: ProductionUnitDefinition;
  state: GameState;
}) {
  const { t: tr, formatNumber } = useI18n();

  const status = unitStatus(state, unit),
    count = ownedUnits(state, unit.id),
    maximum = maxCreatable(state, unit);
  const production = unitProduction(state, unit),
    perUnit = unitProduction(state, unit, 1);
  const reason = creationBlockReason(state, unit),
    source = unit.upgradeFrom ? unitById(unit.upgradeFrom.unitId)! : null;
  const preview = upgradePreview(state, unit);
  function act(
    type: Extract<GameAction, { unitId: string }>['type'],
    amount: number | 'max',
  ) {
    gameStore.dispatch({ type, unitId: unit.id, amount });
  }
  if (status === 'revealed')
    return (
      <article
        className="unit-card locked-unit"
        aria-label={tr('Locked tier {0}', { '0': unit.tier })}
      >
        <div className="unit-card-heading">
          <span className="tag">
            {tr('Tier')} {formatNumber(unit.tier, 0)}
          </span>
          <LockKeyhole size={16} />
        </div>
        <h3>???</h3>
        <p>{tr('Requires new technology')}</p>
        <span className="locked-tier-note">
          {tr('A new way to put your people to work.')}
        </span>
      </article>
    );
  return (
    <article
      className={`unit-card ${count.gt(0) ? 'unit-owned' : ''}`}
      data-unit={unit.id}
      aria-label={tr(unit.name)}
    >
      <div className="unit-card-heading">
        <span className="tag">
          {tr('Tier')} {formatNumber(unit.tier, 0)}
        </span>
        <span className="unit-state">
          {status === 'owned' ? tr('Owned') : tr('Available')}
        </span>
      </div>
      <h3>{tr(unit.name)}</h3>
      <p className="unit-description">{tr(unit.description)}</p>
      <div className="unit-owned-row">
        <strong>{formatNumber(count, 0)}</strong>
        <span>
          {tr('units')}
          <small>
            {formatNumber(count.mul(getPopulationFootprint(unit.id)), 0)}{' '}
            {tr('people represented')}
          </small>
        </span>
      </div>
      <div className="unit-production">
        <ProductionValues values={production} signed />
        <span className="per-unit-rate">
          <ProductionValues values={perUnit} /> {tr('per unit')}
        </span>
      </div>
      <div className="unit-footprint">
        <Users size={12} />
        {formatNumber(getPopulationFootprint(unit.id), 0)}{' '}
        {getPopulationFootprint(unit.id).eq(1) ? tr('person') : tr('people')}{' '}
        {tr('per unit')}
      </div>
      <div className="unit-requirements">
        <span className="field-label">
          {source ? tr('Requires per upgrade') : tr('Recruitment cost')}
        </span>
        {source && unit.upgradeFrom ? (
          <div>
            <span>
              {tr(source.name)} {tr('units')}
            </span>
            <strong
              className={
                ownedUnits(state, source.id).lt(unit.upgradeFrom.amount)
                  ? 'insufficient'
                  : ''
              }
            >
              {formatNumber(unit.upgradeFrom.amount, 0)}
            </strong>
          </div>
        ) : (
          <div>
            <span>{tr('Idle Population')}</span>
            <strong>{formatNumber(getPopulationFootprint(unit.id), 0)}</strong>
          </div>
        )}
        {unitCosts(unit).map((c) => (
          <div key={c.resource}>
            <span>
              {tr(resources.find((r) => r.id === c.resource)?.name ?? '') ||
                c.resource}
            </span>
            <strong
              className={
                state.resources[c.resource].lt(c.amount) ? 'insufficient' : ''
              }
            >
              {formatNumber(c.amount)}
            </strong>
          </div>
        ))}
      </div>
      {source ? (
        <>
          <details className="upgrade-details">
            <summary>
              {tr('Production comparison')}
              <ArrowUpRight size={12} />
            </summary>
            {preview && (
              <>
                <div>
                  <span>{tr('Replaces')}</span>
                  <ProductionValues values={preview.replaced} />
                </div>
                <div>
                  <span>{tr('New unit')}</span>
                  <ProductionValues values={preview.produced} />
                </div>
                <div className="upgrade-gain">
                  <span>{tr('Net gain')}</span>
                  <ProductionValues
                    values={Object.fromEntries(
                      Object.entries(preview.gain).filter(
                        ([id, amount]) => id === unit.category || !amount.eq(0),
                      ),
                    )}
                    signed
                  />
                </div>
              </>
            )}
          </details>
          <div className="unit-buttons upgrade-buttons">
            <button
              className="button primary"
              aria-label={tr('Upgrade 1 {0}', { '0': tr(unit.name) })}
              disabled={maximum.lt(1)}
              title={
                tr(reason ?? '') ||
                tr('Create 1 {0} from {1} {2} units', {
                  '0': tr(unit.name),
                  '1': unit.upgradeFrom!.amount,
                  '2': tr(source.name),
                })
              }
              onClick={() => act('upgrade', 1)}
            >
              {tr('Upgrade 1')}
            </button>
            <button
              className="button"
              aria-label={tr('Upgrade Max {0}', { '0': tr(unit.name) })}
              disabled={maximum.lt(1)}
              title={
                tr(reason ?? '') ||
                tr('Upgrade {0} units', { '0': formatNumber(maximum, 0) })
              }
              onClick={() => act('upgrade', 'max')}
            >
              {tr('Upgrade Max')}
            </button>
          </div>
          <div className="unit-buttons dismantle-buttons">
            <button
              aria-label={tr('Dismantle 1 {0}', { '0': tr(unit.name) })}
              disabled={count.lt(1)}
              title={
                count.lt(1)
                  ? tr('No units to dismantle')
                  : tr('Returns {0} {1} units; resources are not refunded', {
                      '0': unit.upgradeFrom!.amount,
                      '1': tr(source.name),
                    })
              }
              onClick={() => act('dismantle', 1)}
            >
              <RotateCcw size={11} />
              {tr('Dismantle 1')}
            </button>
            <button
              aria-label={tr('Dismantle All {0}', { '0': tr(unit.name) })}
              disabled={count.lt(1)}
              title={tr(
                'Return all units to their previous tier; resources are not refunded',
              )}
              onClick={() => act('dismantle', 'max')}
            >
              {tr('All')}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="unit-buttons recruit-buttons">
            {[1, 10, 'max'].map((quantity) => {
              const n = quantity === 'max' ? maximum : D(quantity);
              const blocked =
                quantity === 'max' ? maximum.lt(1) : maximum.lt(n);
              return (
                <button
                  className="button"
                  key={quantity}
                  aria-label={tr('Recruit {0} {1}', {
                    '0': quantity === 'max' ? tr('Max') : quantity,
                    '1': tr(unit.name),
                  })}
                  disabled={blocked}
                  title={
                    blocked
                      ? (creationBlockReason(
                          state,
                          unit,
                          quantity === 'max' ? 1 : quantity,
                        ) ?? tr('No units available'))
                      : tr('Recruit {0} units', { '0': formatNumber(n, 0) })
                  }
                  onClick={() =>
                    act(
                      'recruit',
                      quantity === 'max' ? 'max' : Number(quantity),
                    )
                  }
                >
                  {quantity === 'max'
                    ? tr('Max')
                    : tr('+{0}', { '0': quantity })}
                </button>
              );
            })}
          </div>
          <div className="unit-buttons release-buttons">
            {[1, 10, 'max'].map((quantity) => (
              <button
                key={quantity}
                aria-label={tr('Release {0} {1}', {
                  '0': quantity === 'max' ? tr('All') : quantity,
                  '1': tr(unit.name),
                })}
                disabled={count.lt(quantity === 'max' ? 1 : quantity)}
                title={tr('Return these people to Idle Population')}
                onClick={() =>
                  act('release', quantity === 'max' ? 'max' : Number(quantity))
                }
              >
                {quantity === 'max' ? tr('All') : tr('−{0}', { '0': quantity })}
              </button>
            ))}
          </div>
        </>
      )}
      {reason && <p className="unit-block-reason">{tr(reason ?? '')}</p>}
    </article>
  );
}
export function WorkforceSheet() {
  const { t: tr, formatNumber } = useI18n();

  const { state } = useGame(),
    { workforceFocus } = useWorkbookNavigation();
  const columns = useRef<Record<string, HTMLElement | null>>({});
  const chains = productionChains(state),
    rates = productionPerSecond(state);
  useEffect(() => {
    if (!workforceFocus) return;
    const target = columns.current[workforceFocus.resource];
    target?.querySelector('header')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
    target?.focus({ preventScroll: true });
  }, [workforceFocus]);
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">{tr('PEOPLE · PRODUCTION · PROGRESS')}</div>
          <h1>{tr('A workforce that grows together.')}</h1>
          <p>
            {tr(
              'Recruit your first units. Build the next tier from the people already working.',
            )}
          </p>
        </div>
        <GrowButton />
      </div>
      <div className="population-accounting">
        <div>
          <span>{tr('Total Population')}</span>
          <strong>{formatNumber(state.population, 0)}</strong>
        </div>
        <span className="accounting-symbol">=</span>
        <div>
          <span>{tr('In production units')}</span>
          <strong>{formatNumber(productionPopulation(state), 0)}</strong>
        </div>
        {state.unlockedFeatures.includes('military') && (
          <>
            <span className="accounting-symbol">+</span>
            <div>
              <span>{tr('Military')}</span>
              <strong>{formatNumber(militaryPopulation(state), 0)}</strong>
            </div>
          </>
        )}
        <span className="accounting-symbol">+</span>
        <div className="idle-account">
          <span>{tr('Idle Population')}</span>
          <strong>{formatNumber(idlePopulation(state), 0)}</strong>
        </div>
      </div>
      <div className="production-chains">
        {chains.map(({ resource, units: chain }) => (
          <section
            className={`production-chain ${workforceFocus?.resource === resource.id ? 'selected-chain' : ''}`}
            key={resource.id}
            data-category={resource.id}
            tabIndex={-1}
            aria-label={
              tr(resource.productionLabel ?? '') ||
              tr('{0} Production', { '0': tr(resource.name) })
            }
            ref={(element) => {
              columns.current[resource.id] = element;
            }}
          >
            <header className="chain-heading">
              <span className="chain-icon" style={{ color: resource.color }}>
                <ResourceIcon id={resource.id} size={20} />
              </span>
              <div>
                <h2>
                  {tr(resource.productionLabel ?? '') ||
                    tr('{0} Production', { '0': tr(resource.name) })}
                </h2>
                <span>
                  {formatNumber(state.resources[resource.id])} {tr('available')}{' '}
                  <b>
                    +{formatNumber(rates[resource.id])}
                    {tr('/s')}
                  </b>
                </span>
              </div>
            </header>
            <div className="chain-units">
              {chain.map((unit) => (
                <div className="chain-tier" key={unit.id}>
                  {unit.upgradeFrom && (
                    <div className="chain-connector">
                      <ArrowDown size={17} />
                      <span>
                        {formatNumber(unit.upgradeFrom.amount, 0)} → 1
                      </span>
                    </div>
                  )}
                  <UnitCard state={state} unit={unit} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <p className="sheet-note">
        {tr(
          'Upgrades keep the same population. Dismantling returns the previous units; upgrade resource costs are not refunded.',
        )}
      </p>
    </>
  );
}
