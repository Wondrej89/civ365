import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { useGame } from '../hooks/useGame';
import { useI18n } from '../i18n/LocaleContext';
import { gameStore } from '../game/store';
import {
  tradeResources,
  tradeQuote,
  tradeEfficiency,
  tradeDiscoveryId,
} from '../game/engine/trade';
import { eras } from '../game/content/eras';
import { balance } from '../game/content/config';
import { technologies } from '../game/content/technologies';
import { ResourceIcon } from './common';
import { Discovery } from './Discovery';
import { D } from '../game/utils/numbers';

export function TradeSheet() {
  const { state } = useGame();
  const { t: tr, formatNumber } = useI18n();
  const [sell, setSell] = useState('materials'),
    [buy, setBuy] = useState('food'),
    [amount, setAmount] = useState('1000');
  const available = tradeResources(state);
  const quote = tradeQuote(state, sell, buy, amount);
  const max = tradeQuote(state, sell, buy, 'max');
  const name = (id: string) =>
    tr(available.find((r) => r.id === id)?.name ?? '');
  return (
    <>
      <div className="sheet-heading">
        <div>
          <div className="eyebrow">
            {tr('SURPLUS · EXCHANGE · INTERNATIONAL TRADE')}
          </div>
          <h1>{tr('Put your surplus to work.')}</h1>
          <p>
            {tr(
              'Exchange Food, Materials and knowledge with other civilizations. Research improves what you receive.',
            )}
          </p>
        </div>
        <ArrowRightLeft size={32} strokeWidth={1.4} />
      </div>
      <div className="realm-kpis">
        <div className="panel">
          <span className="field-label">{tr('Trade efficiency')}</span>
          <strong>{formatNumber(tradeEfficiency(state).mul(100))}%</strong>
        </div>
        <div className="panel">
          <span className="field-label">{tr('Completed exchanges')}</span>
          <strong>{formatNumber(state.statistics.tradesCompleted, 0)}</strong>
        </div>
        <div className="panel">
          <span className="field-label">{tr('Lifetime trade value')}</span>
          <strong>{formatNumber(state.statistics.tradeValueExchanged)}</strong>
        </div>
      </div>
      <Discovery
        as="section"
        discoveryId={tradeDiscoveryId(state)}
        className="panel trade-panel"
      >
        <h2>{tr('International exchange')}</h2>
        <div className="trade-form">
          <label>
            {tr('Sell resource')}
            <select
              aria-label={tr('Sell resource')}
              value={sell}
              onChange={(e) => {
                const id = e.target.value;
                setSell(id);
                if (id === buy) setBuy(sell);
              }}
            >
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {tr(r.name)}
                </option>
              ))}
            </select>
          </label>
          <ArrowRightLeft className="trade-arrow" size={24} />
          <label>
            {tr('Receive resource')}
            <select
              aria-label={tr('Receive resource')}
              value={buy}
              onChange={(e) => {
                const id = e.target.value;
                setBuy(id);
                if (id === sell) setSell(buy);
              }}
            >
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {tr(r.name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {tr('Amount to sell')}
            <input
              aria-label={tr('Amount to sell')}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </div>
        <p className="sheet-note">
          {tr('Available: {amount} {resource}', {
            amount: formatNumber(state.resources[sell]),
            resource: name(sell),
          })}
        </p>
        <div className="trade-actions">
          {[25, 50, 100].map((percent) => (
            <button
              className="button"
              key={percent}
              onClick={() =>
                setAmount(
                  state.resources[sell]
                    .mul(percent / 100)
                    .floor()
                    .toString(),
                )
              }
            >
              {tr('Use {percent}%', { percent })}
            </button>
          ))}
        </div>
        <dl className="growth-details">
          <div>
            <dt>{tr('Exchange rate')}</dt>
            <dd>
              {tr('1 {source} → {amount} {destination}', {
                source: name(sell),
                amount: formatNumber(quote.rate, 4),
                destination: name(buy),
              })}
            </dd>
          </div>
          <div>
            <dt>{tr('You sell')}</dt>
            <dd>
              <ResourceIcon id={sell} size={14} /> {formatNumber(quote.sold)}{' '}
              {name(sell)}
            </dd>
          </div>
          <div>
            <dt>{tr('You receive')}</dt>
            <dd>
              <ResourceIcon id={buy} size={14} /> {formatNumber(quote.received)}{' '}
              {name(buy)}
            </dd>
          </div>
        </dl>
        {quote.reason && (
          <p role="status" className="insufficient">
            {tr(quote.reason)}
          </p>
        )}
        <div className="trade-actions">
          <button
            className="button primary"
            disabled={!!quote.reason}
            onClick={() =>
              gameStore.dispatch({ type: 'trade', sell, buy, amount })
            }
          >
            {tr('Exchange resources')}
          </button>
          <button
            className="button"
            disabled={!!max.reason}
            onClick={() =>
              gameStore.dispatch({ type: 'trade', sell, buy, amount: 'max' })
            }
          >
            {tr('Exchange Max')}
          </button>
        </div>
        <p className="sheet-note">
          {tr(
            'Transport and exchange costs are included in the rate. Receipts are rounded down. Exchanging back returns less than you sold; trade does not increase production statistics.',
          )}
        </p>
      </Discovery>
      <section className="panel trade-panel">
        <h2>{tr('Trade improvements')}</h2>
        <table>
          <thead>
            <tr>
              <th>{tr('Research')}</th>
              <th>{tr('Efficiency bonus')}</th>
              <th>{tr('Status')}</th>
            </tr>
          </thead>
          <tbody>
            {technologies
              .filter((t) =>
                t.effects.some((e) => e.type === 'tradeEfficiencyBonus'),
              )
              .map((tech) => (
                <Discovery
                  as="tr"
                  discoveryId={`trade:improvement:${tech.id}:${state.researchedTechnologies.includes(tech.id) ? 'earned' : 'preview'}`}
                  key={tech.id}
                >
                  <td>
                    {tr(tech.name)}
                    <small className="field-label">
                      {tr(eras.find((era) => era.id === tech.era)!.name)}
                    </small>
                  </td>
                  <td>
                    +
                    {formatNumber(
                      tech.effects
                        .reduce(
                          (n, e) =>
                            e.type === 'tradeEfficiencyBonus'
                              ? n.add(e.value)
                              : n,
                          D(),
                        )
                        .mul(100),
                    )}
                    {tr(' percentage points')}
                  </td>
                  <td>
                    {state.researchedTechnologies.includes(tech.id)
                      ? tr('Researched')
                      : tr('Not researched')}
                  </td>
                </Discovery>
              ))}
          </tbody>
        </table>
        <p className="sheet-note">
          {tr(
            'Efficiency is capped at {percent}%. One Materials has the trade value of {materials} Food; one Research has the value of {research} Food.',
            {
              percent: formatNumber(balance.trade.maximumEfficiency * 100),
              materials: formatNumber(
                balance.trade.resourceValues.materials /
                  balance.trade.resourceValues.food,
              ),
              research: formatNumber(
                balance.trade.resourceValues.research /
                  balance.trade.resourceValues.food,
              ),
            },
          )}
        </p>
      </section>
    </>
  );
}
