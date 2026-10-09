'use client';

/* ============================================================
   Онбординг (порт 4-шагового мастера из демо v1.2):
   приветствие → имя → аватар-эмодзи → демо-данные или чистый лист.
   Показывается полноэкранно при первом визите (profile.onboarded === false).
   Правило DESIGN 1b: эмодзи допустимы только как пользовательский
   контент — сетка аватаров; в заголовках шагов — stroke-иконки.
   ============================================================ */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icon';
import { hv } from '@/lib/store';
import { ONB_EMOJI } from '@/lib/engine';
import { openCatalog, toast } from '@/lib/ui';

function Dots({ step }: { step: number }) {
  return (
    <div className="onb-dots" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => <i key={i} className={i === step ? 'on' : ''} />)}
    </div>
  );
}

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🦊');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) setTimeout(() => nameRef.current?.focus(), 60);
  }, [step]);

  const finish = (withSeed: boolean): void => {
    const finalName = name.trim() || 'Пилот';
    hv.finishOnboarding({ name, emoji, withSeed });
    toast(`Привет, ${finalName}! Нажмите ⌘K для поиска и команд`, 'ok');
    if (!withSeed) setTimeout(() => openCatalog(), 450);
  };

  return (
    <div className="onboarding" role="dialog" aria-modal="true" aria-label="Первичная настройка">
      <div className="onb-stage" key={step}>
        {step === 0 ? (
          <div className="onb-card">
            <span className="em"><Icon name="spark" size={40} /></span>
            <h2>HabitVerse</h2>
            <p>
              Привычки, стрики, календарь, отчёты, заметки, команда и финансы — всё в одном месте.
              Приватность по умолчанию: данные хранятся только в вашем браузере.
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setStep(1)}>
              Начать <Icon name="chevR" size={14} />
            </button>
            <Dots step={step} />
          </div>
        ) : null}

        {step === 1 ? (
          <div className="onb-card">
            <span className="em"><Icon name="users" size={40} /></span>
            <h2>Как вас звать?</h2>
            <p>Имя появится в профиле, ленте и лидерборде.</p>
            <input
              id="onbName" ref={nameRef} className="input" maxLength={30} placeholder="Имя" value={name}
              style={{ textAlign: 'center', fontSize: 16, marginBottom: 16, width: '100%' }}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setStep(2); }}
            />
            <div className="onb-row">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(0)}>
                <Icon name="chevL" size={14} /> Назад
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(2)}>
                Дальше <Icon name="chevR" size={14} />
              </button>
            </div>
            <Dots step={step} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="onb-card">
            <span className="em" style={{ fontSize: 40 }}>{emoji}</span>
            <h2>Выберите аватар</h2>
            <p>Потом можно загрузить фото в настройках профиля.</p>
            <div className="onb-emoji">
              {ONB_EMOJI.map((e) => (
                <button key={e} type="button" aria-label={`Аватар ${e}`} title={e}
                  className={emoji === e ? 'on' : ''} onClick={() => setEmoji(e)}>
                  {e}
                </button>
              ))}
            </div>
            <div className="onb-row">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>
                <Icon name="chevL" size={14} /> Назад
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => setStep(3)}>
                Дальше <Icon name="chevR" size={14} />
              </button>
            </div>
            <Dots step={step} />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="onb-card">
            <span className="em"><Icon name="bolt" size={40} /></span>
            <h2>Поехали</h2>
            <p>
              Наполнить демо-данными (13 привычек, 90 дней истории, друзья, челленджи, реестр трат)
              или начать с чистого листа?
            </p>
            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 9 }} onClick={() => finish(true)}>
              <Icon name="download" size={14} /> Загрузить демо-данные
            </button>
            <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 9 }} onClick={() => finish(false)}>
              <Icon name="leaf" size={14} /> С чистого листа
            </button>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => setStep(2)}>
              <Icon name="chevL" size={14} /> Назад
            </button>
            <Dots step={step} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
