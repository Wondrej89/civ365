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
import { D, formatNumber } from '../game/utils/numbers';
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
          ? 'Population capacity reached. Expand your settlements or acquire more territory.'
          : affordable
            ? 'Welcome one more person'
            : `Need ${formatNumber(cost.sub(state.resources.food))} more Food`
      }
      onClick={() => gameStore.dispatch({ type: 'grow' })}
    >
      <Users size={16} />
      <span>
        Grow Population
        <small>
          {formatNumber(cost)} Food
          {capped && ' · Population capacity reached.'}
          {!affordable &&
            ` · need ${formatNumber(cost.sub(state.resources.food))} more`}
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
  return (
    <>
      {Object.entries(values).map(([id, amount]) => (
        <span className="chain-production-value" key={id}>
          {signed && amount.gte(0) ? '+' : ''}
          {formatNumber(amount)}{' '}
          <small>{resources.find((r) => r.id === id)?.name ?? id}/s</small>
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
        aria-label={`Locked tier ${unit.tier}`}
      >
        <div className="unit-card-heading">
          <span className="tag">Tier {formatNumber(unit.tier, 0)}</span>
          <LockKeyhole size={16} />
        </div>
        <h3>???</h3>
        <p>Requires new technology</p>
        <span className="locked-tier-note">
          A new way to put your people to work.
        </span>
      </article>
    );
  return (
    <article
      className={`unit-card ${count.gt(0) ? 'unit-owned' : ''}`}
      data-unit={unit.id}
      aria-label={unit.name}
    >
      <div className="unit-card-heading">
        <span className="tag">Tier {formatNumber(unit.tier, 0)}</span>
        <span className="unit-state">
          {status === 'owned' ? 'Owned' : 'Available'}
        </span>
      </div>
      <h3>{unit.name}</h3>
      <p className="unit-description">{unit.description}</p>
      <div className="unit-owned-row">
        <strong>{formatNumber(count, 0)}</strong>
        <span>
          units
          <small>
            {formatNumber(count.mul(getPopulationFootprint(unit.id)), 0)} people
            represented
          </small>
        </span>
      </div>
      <div className="unit-production">
        <ProductionValues values={production} signed />
        <span className="per-unit-rate">
          <ProductionValues values={perUnit} /> per unit
        </span>
      </div>
      <div className="unit-footprint">
        <Users size={12} />
        {formatNumber(getPopulationFootprint(unit.id), 0)}{' '}
        {getPopulationFootprint(unit.id).eq(1) ? 'person' : 'people'} per unit
      </div>
      <div className="unit-requirements">
        <span className="field-label">
          {source ? 'Requires per upgrade' : 'Recruitment cost'}
        </span>
        {source && unit.upgradeFrom ? (
          <div>
            <span>{source.name} units</span>
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
            <span>Idle Population</span>
            <strong>{formatNumber(getPopulationFootprint(unit.id), 0)}</strong>
          </div>
        )}
        {unitCosts(unit).map((c) => (
          <div key={c.resource}>
            <span>
              {resources.find((r) => r.id === c.resource)?.name ?? c.resource}
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
              Production comparison
              <ArrowUpRight size={12} />
            </summary>
            {preview && (
              <>
                <div>
                  <span>Replaces</span>
                  <ProductionValues values={preview.replaced} />
                </div>
                <div>
                  <span>New unit</span>
                  <ProductionValues values={preview.produced} />
                </div>
                <div className="upgrade-gain">
                  <span>Net gain</span>
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
              aria-label={`Upgrade 1 ${unit.name}`}
              disabled={maximum.lt(1)}
              title={
                reason ??
                `Create 1 ${unit.name} from ${unit.upgradeFrom!.amount} ${source.name} units`
              }
              onClick={() => act('upgrade', 1)}
            >
              Upgrade 1
            </button>
            <button
              className="button"
              aria-label={`Upgrade Max ${unit.name}`}
              disabled={maximum.lt(1)}
              title={reason ?? `Upgrade ${formatNumber(maximum, 0)} units`}
              onClick={() => act('upgrade', 'max')}
            >
              Upgrade Max
            </button>
          </div>
          <div className="unit-buttons dismantle-buttons">
            <button
              aria-label={`Dismantle 1 ${unit.name}`}
              disabled={count.lt(1)}
              title={
                count.lt(1)
                  ? 'No units to dismantle'
                  : `Returns ${unit.upgradeFrom!.amount} ${source.name} units; resources are not refunded`
              }
              onClick={() => act('dismantle', 1)}
            >
              <RotateCcw size={11} />
              Dismantle 1
            </button>
            <button
              aria-label={`Dismantle All ${unit.name}`}
              disabled={count.lt(1)}
              title="Return all units to their previous tier; resources are not refunded"
              onClick={() => act('dismantle', 'max')}
            >
              All
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
                  aria-label={`Recruit ${quantity === 'max' ? 'Max' : quantity} ${unit.name}`}
                  disabled={blocked}
                  title={
                    blocked
                      ? (creationBlockReason(
                          state,
                          unit,
                          quantity === 'max' ? 1 : quantity,
                        ) ?? 'No units available')
                      : `Recruit ${formatNumber(n, 0)} units`
                  }
                  onClick={() =>
                    act(
                      'recruit',
                      quantity === 'max' ? 'max' : Number(quantity),
                    )
                  }
                >
                  {quantity === 'max' ? 'Max' : `+${quantity}`}
                </button>
              );
            })}
          </div>
          <div className="unit-buttons release-buttons">
            {[1, 10, 'max'].map((quantity) => (
              <button
                key={quantity}
                aria-label={`Release ${quantity === 'max' ? 'All' : quantity} ${unit.name}`}
                disabled={count.lt(quantity === 'max' ? 1 : quantity)}
                title="Return these people to Idle Population"
                onClick={() =>
                  act('release', quantity === 'max' ? 'max' : Number(quantity))
                }
              >
                {quantity === 'max' ? 'All' : `−${quantity}`}
              </button>
            ))}
          </div>
        </>
      )}
      {reason && <p className="unit-block-reason">{reason}</p>}
    </article>
  );
}
export function WorkforceSheet() {
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
          <div className="eyebrow">PEOPLE · PRODUCTION · PROGRESS</div>
          <h1>A workforce that grows together.</h1>
          <p>
            Recruit your first units. Build the next tier from the people
            already working.
          </p>
        </div>
        <GrowButton />
      </div>
      <div className="population-accounting">
        <div>
          <span>Total Population</span>
          <strong>{formatNumber(state.population, 0)}</strong>
        </div>
        <span className="accounting-symbol">=</span>
        <div>
          <span>In production units</span>
          <strong>{formatNumber(productionPopulation(state), 0)}</strong>
        </div>
        {state.unlockedFeatures.includes('military') && (
          <>
            <span className="accounting-symbol">+</span>
            <div>
              <span>Military</span>
              <strong>{formatNumber(militaryPopulation(state), 0)}</strong>
            </div>
          </>
        )}
        <span className="accounting-symbol">+</span>
        <div className="idle-account">
          <span>Idle Population</span>
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
              resource.productionLabel ?? `${resource.name} Production`
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
                  {resource.productionLabel ?? `${resource.name} Production`}
                </h2>
                <span>
                  {formatNumber(state.resources[resource.id])} available{' '}
                  <b>+{formatNumber(rates[resource.id])}/s</b>
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
        Upgrades keep the same population. Dismantling returns the previous
        units; upgrade resource costs are not refunded.
      </p>
    </>
  );
}
