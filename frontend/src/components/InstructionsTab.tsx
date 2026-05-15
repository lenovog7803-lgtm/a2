import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { theme } from '../theme';

type InnerTab = 'script' | 'qualify' | 'emails';

const STEP_ITEMS = [
  {
    num: 1, title: 'Проход через секретаря', hint: 'уверенно, без объяснений',
    lines: ['— Добрый день. Соедините с [директором по логистике / коммерческим директором / руководителем ВЭД], пожалуйста.'],
    objIf: 'Если: «По какому вопросу?»',
    objAnswer: '— По вопросу грузоперевозок Москва–Минск. Меня зовут [имя], компания A2Group.',
    tip: 'Называй должность, а не «кто отвечает за логистику» — звучит профессионально и проходит лучше.',
  },
  {
    num: 2, title: 'Открытие — первые 20 секунд', hint: 'не продаём — квалифицируем',
    lines: [
      '— Добрый день, [имя]. Меня зовут [ваше имя], компания A2Group, занимаемся грузоперевозками между Беларусью и Россией.',
      '— Звоню по конкретной причине: мы работаем с несколькими ритейл-компаниями, которые регулярно возят товар по маршруту Москва–Минск, и видим, что на этом плече есть запас по скорости и стоимости — особенно на обратных загрузках.',
      '— Скажите, у вас сейчас есть регулярные поставки по этому направлению?',
    ],
    tip: 'Первый вопрос — закрытый, на «да/нет». Не спрашивай «можем ли мы сотрудничать» — это слабая позиция.',
  },
  {
    num: 3, title: 'Квалификация — 3 ключевых вопроса', hint: 'если ответил «да» на открытие',
    lines: [
      '— Отлично. Несколько коротких вопросов, чтобы понять, насколько мы можем быть полезны:',
      '1. Как часто у вас идут отгрузки — еженедельно, раз в две недели?',
      '2. Работаете сейчас с одним перевозчиком или с несколькими?',
      '3. Если появится возможность снизить стоимость рейса или сократить время подачи машины — это актуально для вас?',
    ],
    tip: 'Три вопроса — не больше. Задача: понять частоту, наличие конкурента и болевую точку.',
  },
  {
    num: 4, title: 'Ценностное предложение', hint: 'под конкретную боль',
    subVariants: [
      {
        label: 'Если боль — цена',
        line: '— Мы работаем как экспедитор с широкой сетью перевозчиков на плече РБ–РФ, поэтому на обратных загрузках даём ставку на 10–20% ниже рынка. На регулярном объёме это фиксируем в договоре.',
      },
      {
        label: 'Если боль — надёжность / срывы',
        line: '— У нас сквозной контроль каждого рейса: заявка клиенту, заявка перевозчику и акт — всё в системе, статус онлайн. Срыв подачи — мы закрываем своими силами в течение 4 часов.',
      },
      {
        label: 'Если боль — документы / бухгалтерия',
        line: '— Весь документооборот — ТТН, акты, счета — формируем автоматически и отправляем день в день. Для вашего бухгалтера это закрытый вопрос.',
      },
    ],
    tip: '',
  },
  {
    num: 5, title: 'Закрытие на следующий шаг', hint: 'конкретно, без «подумайте»',
    lines: [
      '— Предлагаю сделать так: скиньте мне один ближайший рейс — маршрут, дата, тип груза — я дам вам ставку в течение часа. Сравните с тем, что платите сейчас, и примете решение.',
      '— Куда лучше написать — на почту или в WhatsApp?',
    ],
    tip: 'Не говори «вышлю КП» — это откладывает решение. Конкретный рейс → конкретная цифра → сравнение. Это работает.',
  },
];

const OBJECTIONS = [
  {
    q: '«Нас всё устраивает, есть постоянный перевозчик»',
    a: '— Рад слышать. Я и не предлагаю менять — предлагаю иметь второй надёжный контакт на случай, если основной не сможет подать машину. Это случается. Один рейс в тест — ничем не рискуете.',
  },
  {
    q: '«Пришлите КП на почту»',
    a: '— Хорошо, пришлю. Чтобы КП было предметным, скажите: какой объём рейсов в месяц и по каким направлениям основная нагрузка? Тогда укажу конкретные ставки, а не общий прайс.',
  },
  {
    q: '«Дорого» / «У других дешевле»',
    a: '— Понимаю. Давайте проверим — скиньте последнюю ставку, которую вам давали по этому маршруту. Я дам встречное предложение в течение часа. Если не выгоднее — скажу прямо.',
  },
  {
    q: '«Сейчас не актуально, нет объёмов»',
    a: '— Понял. Когда обычно начинается активный сезон у вас? Свяжусь заранее, чтобы к пиковому периоду у вас был готовый контакт. Можно вас добавить в базу?',
  },
  {
    q: '«Вы ИП, нам нужно юрлицо»',
    a: '— Мы работаем по договору с полным пакетом документов: ТТН, акты, счета-фактуры. Форма собственности не влияет на документооборот — у нас десятки юрлиц в клиентской базе. Пришлю образец договора?',
  },
  {
    q: '«Перезвоните через месяц»',
    a: '— Хорошо. Поставлю на [конкретная дата]. Скажите, что к тому моменту должно измениться, чтобы разговор был предметным? Хочу быть готов.',
  },
];

const QUAL_METRICS = [
  { value: '27', label: 'убыточных рейсов', sub: '−3 799 BYN', color: theme.colors.loss },
  { value: '140', label: 'рейсов маржа <100 BYN', sub: '+5 030 BYN', color: theme.colors.warning },
  { value: '36%', label: 'слабых или убыточных', sub: 'от всех рейсов', color: theme.colors.info },
  { value: '129', label: 'рейсов 300+ BYN', sub: '75 622 BYN', color: theme.colors.profit },
];

const RATE_TABLE = [
  { route: 'Москва↔Минск', cost: '720 BYN', min: '50 BYN', threshold: '865 BYN', status: 'red' },
  { route: 'СПб↔Минск', cost: '406 BYN', min: '75 BYN', threshold: '487 BYN', status: 'red' },
  { route: 'Минск↔Москва', cost: '492 BYN', min: '150 BYN', threshold: '590 BYN', status: 'red' },
  { route: 'Жодино↔Москва', cost: '543 BYN', min: '250 BYN', threshold: '651 BYN', status: 'yellow' },
  { route: 'Ульяновск-Минск', cost: '1 328 BYN', min: '900 BYN', threshold: '1 594 BYN', status: 'yellow' },
  { route: 'Минск-Минск (лок.)', cost: '130 BYN', min: '0 BYN', threshold: '200 BYN', status: 'red' },
  { route: 'Смоленск-Минск', cost: '335 BYN', min: '160 BYN', threshold: '402 BYN', status: 'yellow' },
];

const QUAL_QUESTIONS = [
  {
    num: 1, title: 'Маршрут и дата', hint: 'фильтр по направлению',
    line: '— Скажите маршрут и примерную дату загрузки?',
    ok: 'РБ↔РФ, дата конкретная или «на этой неделе»',
    stop: '«Не знаю», «когда найдём машину» — нет серьёзности. Уточнить или отложить.',
    tip: '',
  },
  {
    num: 2, title: 'Бюджет — ставка клиента', hint: 'главный фильтр',
    line: '— Какой бюджет на перевозку вы рассматриваете? Или по какой ставке возили раньше?',
    ok: 'Называет цифру выше порогового значения по маршруту. Москва-Минск: от 865 BYN.',
    stop: '«Как можно дешевле», «возили за 300» на маршруте Москва-Минск — ниже себестоимости.',
    tip: 'Если клиент не называет цифру — называй сам: «На этом направлении наша минимальная ставка — X BYN. Это для вас приемлемо?»',
  },
  {
    num: 3, title: 'Тип груза и вес', hint: 'фильтр нестандарта',
    line: '— Что везём — тип груза, вес, нужен ли рефрижератор или тент?',
    ok: 'Стандартный тент/фура, вес до 20 т, груз без спецтребований',
    stop: 'Опасные грузы, негабарит, живые животные, рефрижератор без наценки',
    tip: '',
  },
  {
    num: 4, title: 'Оплата и отсрочка', hint: 'фильтр кассовых разрывов',
    line: '— Как обычно работаете по оплате — предоплата, постоплата, какой срок?',
    ok: 'Предоплата 50–100% или постоплата до 14 дней с проверенными клиентами',
    stop: 'Отсрочка 45–60 дней от нового клиента без гарантий — риск кассового разрыва',
    tip: 'Новый клиент: первые 2–3 рейса — предоплата или оплата по факту.',
  },
];

const PRICE_PHRASES = [
  {
    text: '— На этом маршруте у нас минимальная ставка — [X] BYN. Ниже я не смогу гарантировать надёжного перевозчика и сроки. Если для вас это не подходит — лучше скажу сразу, чем подведу на рейсе.',
    tip: 'Это не отказ — это позиция. Клиент уважает чёткие условия больше, чем уступки.',
  },
  {
    text: '— Понимаю, что хочется сэкономить. Давайте так: скиньте дату и груз — я посмотрю, есть ли у меня обратная загрузка на этом плече. Тогда смогу дать ставку ближе к вашему бюджету.',
    tip: 'Обратная загрузка — единственный способ законно снизить ставку без потери маржи.',
  },
];

const VERDICT_TAKE = [
  'Маршрут РБ↔РФ, дата конкретная',
  'Ставка выше порогового минимума',
  'Стандартный груз, тент/фура',
  'Оплата до 14 дней или предоплата',
  'Есть ЛПР, принимает решение сам',
];

const VERDICT_REJECT = [
  'Ставка ниже порога, не торгуется',
  'Маршрут вне РБ-РФ',
  'Нет конкретной даты и груза',
  'Требует отсрочку 30+ дней (новый)',
  'Нестандартный груз без наценки',
];

type EmailKey = 'A' | 'B' | 'C';
const EMAILS: { key: EmailKey; label: string; when: string; subject: string; body: string }[] = [
  {
    key: 'A', label: 'А — Тест-рейс', when: 'клиент согласился попробовать',
    subject: 'A2Group — грузоперевозки Москва–Минск, договорились на звонке',
    body: `Добрый день, [Имя]!

Спасибо за разговор — как и обещал, пишу сразу.

Мы специализируемся на перевозках Москва↔Минск и Санкт-Петербург↔Минск: подача машины от 4 часов, полный документооборот день в день (ТТН, акты, счета).

Предлагаю проверить нас на одном рейсе — скиньте маршрут и дату, я дам ставку в течение часа.

Если удобнее — ответьте на это письмо или напишите в WhatsApp: +375 XX XXX-XX-XX.

С уважением,
[Имя]
A2Group | info@a2group.by`,
  },
  {
    key: 'B', label: 'В — Давление ценой', when: 'клиент сомневается из-за стоимости',
    subject: 'Ставка по маршруту Москва–Минск — A2Group',
    body: `Добрый день, [Имя]!

По итогам звонка — как и обещал, отправляю контакт.

На регулярных рейсах Москва↔Минск мы даём ставку на 10–15% ниже рынка за счёт обратных загрузок — фиксируем это в договоре.

Чтобы показать конкретную цифру: скиньте последнюю ставку по вашему маршруту — сравним честно, без давления.

Ответьте на письмо или в WhatsApp: +375 XX XXX-XX-XX.

С уважением,
[Имя]
A2Group | info@a2group.by`,
  },
  {
    key: 'C', label: 'С — Отложенный контакт', when: 'сказал «сейчас не актуально»',
    subject: 'A2Group — договорились связаться в [месяц]',
    body: `Добрый день, [Имя]!

Как и договорились на звонке — пишу, чтобы остаться на связи.

Мы занимаемся перевозками Беларусь↔Россия: Москва, Санкт-Петербург, Ульяновск и другие направления — полный пакет документов, подача от 4 часов.

Когда объёмы станут актуальны, напишите — подготовлю ставку под ваш маршрут в течение часа.

До связи,
[Имя]
A2Group | info@a2group.by`,
  },
];

const EMAIL_RULES = [
  'Тема письма — конкретная. Тема с маршрутом открывается на 30% чаще чем «сотрудничество»',
  'Отправляй в течение 30 минут после звонка, пока контакт горячий',
  'Не прикладывай КП к первому письму. КП — только после того как клиент дал маршрут на расчёт',
];

function Tip({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View style={s.tipRow}>
      <View style={s.tipBar} />
      <Text style={s.tipText}>{text}</Text>
    </View>
  );
}

function ScriptLine({ text }: { text: string }) {
  return <Text style={s.scriptLine}>{text}</Text>;
}

function StepCard({ item }: { item: typeof STEP_ITEMS[0] }) {
  return (
    <View style={s.stepCard}>
      <View style={s.stepHeader}>
        <View style={s.stepNum}>
          <Text style={s.stepNumText}>{item.num}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.stepTitle}>{item.title}</Text>
          <Text style={s.stepHint}>{item.hint}</Text>
        </View>
      </View>
      <View style={s.scriptBox}>
        {'lines' in item && item.lines?.map((l, i) => <ScriptLine key={i} text={l} />)}
        {'subVariants' in item && item.subVariants?.map((v, i) => (
          <View key={i} style={{ marginTop: i > 0 ? 10 : 0 }}>
            <Text style={s.variantLabel}>{v.label}</Text>
            <ScriptLine text={v.line} />
          </View>
        ))}
      </View>
      {'objIf' in item && item.objIf ? (
        <View style={s.objIfBox}>
          <Text style={s.objIfLabel}>{item.objIf}</Text>
          <Text style={s.scriptLine}>{item.objAnswer}</Text>
        </View>
      ) : null}
      <Tip text={item.tip} />
    </View>
  );
}

function ScriptTab() {
  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Скрипт холодного звонка — FMCG / ритейл</Text>
        <Text style={s.sectionSub}>Целевой профиль: ритейл/FMCG, регулярные рейсы Москва↔Минск, средний чек 1 000–4 000 BYN</Text>
      </View>
      {STEP_ITEMS.map(item => <StepCard key={item.num} item={item} />)}

      <Text style={s.blockTitle}>Отработка возражений</Text>
      <View style={s.objGrid}>
        {OBJECTIONS.map((o, i) => (
          <View key={i} style={s.objCard}>
            <View style={s.objHead}>
              <Text style={s.objQ}>{o.q}</Text>
            </View>
            <Text style={s.objA}>{o.a}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function QualifyTab() {
  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Система квалификации лидов</Text>
        <Text style={s.sectionSub}>4 вопроса при первом контакте — брать или нет</Text>
      </View>

      <Text style={s.blockTitle}>Факты из CRM</Text>
      <View style={s.metricsRow}>
        {QUAL_METRICS.map((m, i) => (
          <View key={i} style={[s.metricCard, { borderColor: m.color + '40', backgroundColor: m.color + '12' }]}>
            <Text style={[s.metricVal, { color: m.color }]}>{m.value}</Text>
            <Text style={s.metricLabel}>{m.label}</Text>
            <Text style={[s.metricSub, { color: m.color }]}>{m.sub}</Text>
          </View>
        ))}
      </View>

      <View style={[s.alertBox, { backgroundColor: theme.colors.loss + '14', borderColor: theme.colors.loss + '30' }]}>
        <Text style={[s.alertText, { color: theme.colors.loss }]}>
          {'⚠ Главная проблема: ФлорКонцепт — 10 убыточных рейсов (Минск-Минск, Минск-Брест по ставке 0–120 BYN при себестоимости 80–400 BYN). Нужно ввести минимальный порог.'}
        </Text>
      </View>
      <View style={[s.alertBox, { backgroundColor: theme.colors.warning + '14', borderColor: theme.colors.warning + '30' }]}>
        <Text style={[s.alertText, { color: theme.colors.warning }]}>
          {'⚠ Второй очаг: ЗападВетСервис — 4 убыточных рейса, маршруты Жодино-Москва с заниженной ставкой.'}
        </Text>
      </View>

      <Text style={s.blockTitle}>Минимальные пороги ставки — по маршрутам</Text>
      <View style={s.tableCard}>
        <View style={[s.tableRow, s.tableHead]}>
          <Text style={[s.thCell, { flex: 2 }]}>Маршрут</Text>
          <Text style={[s.thCell, { flex: 1 }]}>Себест.</Text>
          <Text style={[s.thCell, { flex: 1 }]}>Мин.</Text>
          <Text style={[s.thCell, { flex: 1 }]}>Порог</Text>
          <Text style={[s.thCell, { flex: 1.2 }]}>Статус</Text>
        </View>
        {RATE_TABLE.map((r, i) => {
          const isRed = r.status === 'red';
          const badgeColor = isRed ? theme.colors.loss : theme.colors.warning;
          const badgeLabel = isRed ? 'Срочно' : 'Скорр.';
          return (
            <View key={i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
              <Text style={[s.tdCell, { flex: 2 }]} numberOfLines={1}>{r.route}</Text>
              <Text style={[s.tdCell, { flex: 1 }]}>{r.cost}</Text>
              <Text style={[s.tdCell, { flex: 1, color: theme.colors.loss }]}>{r.min}</Text>
              <Text style={[s.tdCell, { flex: 1, fontWeight: '700' }]}>{r.threshold}</Text>
              <View style={{ flex: 1.2, alignItems: 'flex-start' }}>
                <View style={[s.badge, { backgroundColor: badgeColor + '20', borderColor: badgeColor + '40' }]}>
                  <Text style={[s.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={s.tableNote}>Порог = средняя ставка перевозчика × 1.20. Это минимум 20% маржи на рейс.</Text>

      <Text style={s.blockTitle}>4 вопроса квалификации</Text>
      {QUAL_QUESTIONS.map(q => (
        <View key={q.num} style={s.stepCard}>
          <View style={s.stepHeader}>
            <View style={s.stepNum}>
              <Text style={s.stepNumText}>{q.num}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.stepTitle}>{q.title}</Text>
              <Text style={s.stepHint}>{q.hint}</Text>
            </View>
          </View>
          <View style={s.scriptBox}>
            <ScriptLine text={q.line} />
          </View>
          <View style={s.verdictRow}>
            <View style={[s.verdictHalf, { backgroundColor: theme.colors.profit + '12', borderColor: theme.colors.profit + '30' }]}>
              <Text style={[s.verdictHead, { color: theme.colors.profit }]}>Берём</Text>
              <Text style={s.verdictBody}>{q.ok}</Text>
            </View>
            <View style={[s.verdictHalf, { backgroundColor: theme.colors.loss + '12', borderColor: theme.colors.loss + '30' }]}>
              <Text style={[s.verdictHead, { color: theme.colors.loss }]}>Стоп</Text>
              <Text style={s.verdictBody}>{q.stop}</Text>
            </View>
          </View>
          <Tip text={q.tip} />
        </View>
      ))}

      <Text style={s.blockTitle}>Что говорить, когда клиент давит на цену ниже порога</Text>
      {PRICE_PHRASES.map((p, i) => (
        <View key={i} style={[s.stepCard, { marginBottom: 12 }]}>
          <View style={s.scriptBox}>
            <ScriptLine text={p.text} />
          </View>
          <Tip text={p.tip} />
        </View>
      ))}

      <Text style={s.blockTitle}>Итоговый вердикт</Text>
      <View style={s.verdictRow}>
        <View style={[s.verdictCard, { backgroundColor: theme.colors.profit + '10', borderColor: theme.colors.profit + '30' }]}>
          <Text style={[s.verdictCardHead, { color: theme.colors.profit }]}>Берём в работу</Text>
          {VERDICT_TAKE.map((t, i) => (
            <Text key={i} style={[s.verdictItem, { color: theme.colors.profit }]}>{'✓ ' + t}</Text>
          ))}
        </View>
        <View style={[s.verdictCard, { backgroundColor: theme.colors.loss + '10', borderColor: theme.colors.loss + '30' }]}>
          <Text style={[s.verdictCardHead, { color: theme.colors.loss }]}>Отказываем / откладываем</Text>
          {VERDICT_REJECT.map((t, i) => (
            <Text key={i} style={[s.verdictItem, { color: theme.colors.loss }]}>{'✗ ' + t}</Text>
          ))}
        </View>
      </View>
    </>
  );
}

function EmailsTab() {
  const [active, setActive] = useState<EmailKey>('A');
  const email = EMAILS.find(e => e.key === active)!;
  return (
    <>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Шаблоны писем после звонка</Text>
        <Text style={s.sectionSub}>Отправляй в течение 30 минут после разговора</Text>
      </View>

      <View style={s.emailTabs}>
        {EMAILS.map(e => (
          <TouchableOpacity
            key={e.key}
            onPress={() => setActive(e.key)}
            style={[s.emailTabBtn, active === e.key && s.emailTabBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[s.emailTabText, active === e.key && s.emailTabTextActive]}>{e.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.emailCard}>
        <View style={[s.alertBox, { backgroundColor: theme.colors.info + '14', borderColor: theme.colors.info + '30', marginBottom: 14, marginHorizontal: 0 }]}>
          <Text style={[s.alertText, { color: theme.colors.info }]}>Когда использовать: {email.when}</Text>
        </View>
        <Text style={s.emailSubjectLabel}>Тема письма</Text>
        <View style={s.emailSubjectBox}>
          <Text style={s.emailSubjectText}>{email.subject}</Text>
        </View>
        <Text style={s.emailSubjectLabel}>Текст</Text>
        <View style={s.emailBodyBox}>
          <Text style={s.emailBodyText}>{email.body}</Text>
        </View>
      </View>

      <Text style={s.blockTitle}>Правила</Text>
      {EMAIL_RULES.map((rule, i) => (
        <View key={i} style={s.ruleRow}>
          <View style={[s.ruleNum, { backgroundColor: theme.colors.info + '20' }]}>
            <Text style={[s.ruleNumText, { color: theme.colors.info }]}>{i + 1}</Text>
          </View>
          <Text style={s.ruleText}>{rule}</Text>
        </View>
      ))}
    </>
  );
}

export default function InstructionsTab() {
  const [inner, setInner] = useState<InnerTab>('script');
  return (
    <View style={{ flex: 1 }}>
      <View style={s.innerTabs}>
        {([['script', 'Скрипт звонка'], ['qualify', 'Квалификация'], ['emails', 'Письма']] as [InnerTab, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            onPress={() => setInner(key)}
            style={[s.innerTabBtn, inner === key && s.innerTabBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[s.innerTabText, inner === key && s.innerTabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {inner === 'script' ? <ScriptTab /> : inner === 'qualify' ? <QualifyTab /> : <EmailsTab />}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  innerTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  innerTabBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  innerTabBtnActive: {
    backgroundColor: theme.colors.info + '20',
    borderColor: theme.colors.info + '50',
  },
  innerTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  innerTabTextActive: {
    color: theme.colors.info,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 0,
  },

  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: theme.colors.textTertiary },

  blockTitle: {
    fontSize: 14, fontWeight: '700', color: theme.colors.textSecondary,
    marginTop: 20, marginBottom: 10,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  stepCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.info + '20',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.info + '40',
    flexShrink: 0,
  },
  stepNumText: { fontSize: 13, fontWeight: '700', color: theme.colors.info },
  stepTitle: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 2 },
  stepHint: { fontSize: 11, color: theme.colors.textTertiary, fontStyle: 'italic' },

  scriptBox: {
    backgroundColor: theme.colors.bg,
    borderRadius: 8,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  scriptLine: { fontSize: 13, color: theme.colors.textPrimary, fontStyle: 'italic', lineHeight: 19 },
  variantLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.textTertiary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  objIfBox: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning + '60',
    paddingLeft: 10,
    gap: 4,
  },
  objIfLabel: { fontSize: 11, color: theme.colors.warning, fontWeight: '700' },

  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  tipBar: { width: 3, borderRadius: 2, backgroundColor: theme.colors.accent + '60', alignSelf: 'stretch', minHeight: 16 },
  tipText: { flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },

  objGrid: { gap: 8 },
  objCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  objHead: {
    backgroundColor: theme.colors.bg,
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  objQ: { fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary },
  objA: { fontSize: 13, color: theme.colors.textPrimary, padding: 10, lineHeight: 19 },

  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metricCard: {
    flex: 1, minWidth: '45%', borderRadius: 10, borderWidth: 1,
    padding: 12, alignItems: 'center', gap: 2,
  },
  metricVal: { fontSize: 22, fontWeight: '300', letterSpacing: -0.5 },
  metricLabel: { fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center' },
  metricSub: { fontSize: 12, fontWeight: '700' },

  alertBox: {
    borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 8,
    marginHorizontal: 0,
  },
  alertText: { fontSize: 13, lineHeight: 18 },

  tableCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    marginBottom: 6,
  },
  tableHead: { backgroundColor: theme.colors.bg },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  tableRowAlt: { backgroundColor: theme.colors.bg + '60' },
  thCell: { fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
  tdCell: { fontSize: 12, color: theme.colors.textPrimary },
  badge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  tableNote: { fontSize: 11, color: theme.colors.textTertiary, fontStyle: 'italic', marginBottom: 4 },

  verdictRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  verdictHalf: { flex: 1, borderRadius: 8, borderWidth: 1, padding: 10 },
  verdictHead: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  verdictBody: { fontSize: 12, color: theme.colors.textSecondary, lineHeight: 17 },

  verdictCard: { flex: 1, borderRadius: 10, borderWidth: 1, padding: 12, gap: 4 },
  verdictCardHead: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  verdictItem: { fontSize: 12, lineHeight: 18 },

  emailTabs: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  emailTabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  emailTabBtnActive: { backgroundColor: theme.colors.accent + '18', borderColor: theme.colors.accent + '50' },
  emailTabText: { fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary },
  emailTabTextActive: { color: theme.colors.accent },

  emailCard: {
    backgroundColor: theme.colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: theme.colors.border,
    padding: 14, marginBottom: 16,
  },
  emailSubjectLabel: { fontSize: 10, fontWeight: '700', color: theme.colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  emailSubjectBox: {
    backgroundColor: theme.colors.bg, borderRadius: 8, padding: 10,
    marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border,
  },
  emailSubjectText: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary },
  emailBodyBox: {
    backgroundColor: theme.colors.bg, borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  emailBodyText: { fontSize: 13, color: theme.colors.textPrimary, lineHeight: 20 },

  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  ruleNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ruleNumText: { fontSize: 12, fontWeight: '700' },
  ruleText: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 },
});
