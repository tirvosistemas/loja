// Avaliações, clientes, endereços e pedidos de demonstração (Curitiba e região).

export type SeedReview = {
  product: string;
  name: string;
  city: string;
  rating: number;
  title: string;
  comment: string;
  daysAgo: number;
  approved?: boolean;
};

export const REVIEWS: SeedReview[] = [
  { product: "gel-duplex-375", name: "Marcos Vieira", city: "Curitiba · Água Verde", rating: 5, title: "Silenciosa e gela muito bem", comment: "Chegou no mesmo dia, o entregador ajudou a colocar na cozinha. Não faz barulho e o freezer gela rápido.", daysAgo: 4 },
  { product: "gel-duplex-375", name: "Juliana Prestes", city: "São José dos Pinhais", rating: 5, title: "Linda e espaçosa", comment: "O inox combinou com a cozinha. Cabe a compra da semana inteira e o painel por fora é muito prático.", daysAgo: 12 },
  { product: "gel-duplex-375", name: "Roberto Kühn", city: "Curitiba · Portão", rating: 4, title: "Boa compra", comment: "Geladeira ótima. Só achei a gaveta de legumes um pouco baixa, mas atende bem.", daysAgo: 26 },
  { product: "gel-duplex-375", name: "Aline Ferraz", city: "Colombo", rating: 5, title: "Recomendo", comment: "Atendimento pelo WhatsApp muito rápido, tiraram todas as minhas dúvidas sobre as medidas.", daysAgo: 41 },
  { product: "gel-inverse-454", name: "Thiago Borges", city: "Curitiba · Bigorrilho", rating: 5, title: "Freezer embaixo faz diferença", comment: "Nunca mais vou querer outra. Tudo na altura dos olhos e muito econômica na conta de luz.", daysAgo: 9 },
  { product: "gel-inverse-454", name: "Carla Mendes", city: "Pinhais", rating: 4, title: "Muito boa", comment: "Gela bem e é bem silenciosa. A entrega atrasou uma hora, mas me avisaram pelo WhatsApp.", daysAgo: 22 },
  { product: "gel-side-602", name: "Eduardo Lins", city: "Curitiba · Ecoville", rating: 5, title: "Vale cada centavo", comment: "O dispenser de água gelada é o que mais usamos. Espaço de sobra para a família toda.", daysAgo: 16 },
  { product: "gel-1porta-300", name: "Sandra Lopes", city: "Almirante Tamandaré", rating: 5, title: "Ótima para apartamento", comment: "Comprei para a kitnet do meu filho. Econômica e cabe tudo que ele precisa.", daysAgo: 7 },
  { product: "gel-1porta-300", name: "Paulo Henrique", city: "Curitiba · CIC", rating: 4, title: "Simples e boa", comment: "Faz o que promete. Precisa descongelar de vez em quando, mas isso já era esperado.", daysAgo: 33 },
  { product: "freezer-197", name: "Rosângela Duarte", city: "Araucária", rating: 5, title: "Organização total", comment: "As gavetas transparentes ajudam muito a achar as coisas. Uso para as marmitas da semana.", daysAgo: 19 },
  { product: "fogao-5b-vidro", name: "Fernanda Kloss", city: "Curitiba · Juvevê", rating: 5, title: "Lindo demais", comment: "A mesa de vidro é muito fácil de limpar e a tripla chama é forte. O forno assa por igual.", daysAgo: 5 },
  { product: "fogao-5b-vidro", name: "Ricardo Taques", city: "Fazenda Rio Grande", rating: 5, title: "Entrega rápida", comment: "Pedi de manhã e chegou à tarde. Fogão muito bonito e bem acabado.", daysAgo: 18 },
  { product: "fogao-5b-vidro", name: "Luciana Wosch", city: "Curitiba · Boqueirão", rating: 4, title: "Gostei", comment: "Ótimo fogão. Precisei chamar um técnico para converter para gás encanado, mas foi tranquilo.", daysAgo: 37 },
  { product: "fogao-4b-inox", name: "Mateus Ribas", city: "Curitiba · Rebouças", rating: 4, title: "Compacto e eficiente", comment: "Cabe certinho na cozinha pequena. O forno é maior do que eu esperava.", daysAgo: 24 },
  { product: "cooktop-inducao-4", name: "Beatriz Nogueira", city: "Curitiba · Batel", rating: 5, title: "Mudou minha cozinha", comment: "Ferve a água em dois minutos. Precisei trocar algumas panelas, mas valeu muito.", daysAgo: 11 },
  { product: "cooktop-gas-5", name: "Anderson Pires", city: "São José dos Pinhais", rating: 4, title: "Bom custo-benefício", comment: "Trempes firmes e acendimento perfeito. Recomendo.", daysAgo: 29 },
  { product: "micro-32-grill", name: "Patrícia Ramos", city: "Curitiba · Cabral", rating: 5, title: "O grill é ótimo", comment: "Gratina lasanha e pão de queijo muito bem. Tamanho bom para travessas.", daysAgo: 3 },
  { product: "micro-32-grill", name: "Gustavo Hartmann", city: "Pinhais", rating: 5, title: "Recomendo", comment: "Bonito, silencioso e fácil de usar. Chegou bem embalado.", daysAgo: 14 },
  { product: "micro-32-grill", name: "Vanessa Moro", city: "Curitiba · Santa Felicidade", rating: 4, title: "Muito bom", comment: "Só achei o bipe um pouco alto, mas o aparelho é excelente.", daysAgo: 27 },
  { product: "forno-bancada-44", name: "Cláudia Bertoldi", city: "Campo Largo", rating: 4, title: "Assa muito bem", comment: "Uso para pães e bolos. Esquenta rápido e o timer ajuda bastante.", daysAgo: 21 },
  { product: "lava-seca-11", name: "Felipe Gaertner", city: "Curitiba · Água Verde", rating: 5, title: "Salvou meu apartamento", comment: "Sem varal no apê, a função secar é perfeita. Silenciosa até na centrifugação.", daysAgo: 6 },
  { product: "lava-seca-11", name: "Mariana Costa", city: "Curitiba · Mercês", rating: 5, title: "Excelente", comment: "Lava muito bem e a função vapor deixa as roupas quase sem amassar.", daysAgo: 30 },
  { product: "lavadora-12", name: "Simone Krüger", city: "Colombo", rating: 5, title: "Lava até edredom", comment: "Coube o edredom de casal sem problema. Gosto da tampa de vidro.", daysAgo: 10 },
  { product: "lavadora-12", name: "Jorge Almeida", city: "Curitiba · Sítio Cercado", rating: 4, title: "Boa lavadora", comment: "Faz menos barulho que a antiga. O ciclo rápido é ótimo para o dia a dia.", daysAgo: 35 },
  { product: "ar-12k-inverter", name: "Daniel Schulz", city: "Curitiba · Centro", rating: 5, title: "Silencioso de verdade", comment: "Instalei no quarto e mal escuto. A conta de luz quase não mudou.", daysAgo: 8 },
  { product: "ar-12k-inverter", name: "Renata Fontana", city: "São José dos Pinhais", rating: 5, title: "Controle pelo celular é ótimo", comment: "Ligo antes de chegar em casa. Entrega rapidíssima.", daysAgo: 20 },
  { product: "ar-9k-qf", name: "Leonardo Zanella", city: "Curitiba · Bacacheri", rating: 5, title: "Perfeito para o inverno", comment: "Usamos mais para aquecer do que para resfriar. Esquenta o quarto em minutos.", daysAgo: 15 },
  { product: "ventilador-coluna-40", name: "Priscila Antunes", city: "Pinhais", rating: 4, title: "Bom ventilador", comment: "Venta bastante e não faz muito barulho na velocidade 1.", daysAgo: 13 },
  { product: "ventilador-coluna-40", name: "Rodrigo Mattos", city: "Curitiba · Portão", rating: 5, title: "Ótimo", comment: "Montagem fácil, firme e silencioso.", daysAgo: 38 },
  { product: "aquecedor-oleo-1500", name: "Helena Wiedmer", city: "Curitiba · Seminário", rating: 5, title: "Não resseca o ar", comment: "Fica ligado a noite toda no quarto do bebê sem ressecar o ambiente.", daysAgo: 17 },
  { product: "termoventilador-2000", name: "Sérgio Bubniak", city: "Araucária", rating: 4, title: "Esquenta rápido", comment: "Pequeno e potente. Uso no escritório nas manhãs frias.", daysAgo: 25 },
  { product: "airfryer-55", name: "Camila Lacerda", city: "Curitiba · Hauer", rating: 5, title: "Uso todo dia", comment: "Batata crocante sem óleo e o cesto é fácil de lavar. O painel digital é muito intuitivo.", daysAgo: 2 },
  { product: "airfryer-55", name: "Bruno Ferreira", city: "Colombo", rating: 5, title: "Melhor compra do ano", comment: "Tamanho ótimo para a família. Chegou no mesmo dia.", daysAgo: 9 },
  { product: "airfryer-55", name: "Tatiane Gomes", city: "Curitiba · Novo Mundo", rating: 4, title: "Muito boa", comment: "Faz tudo bem. Achei que o timer poderia ir além de 60 minutos.", daysAgo: 23 },
  { product: "airfryer-55", name: "Eliane Prado", city: "Fazenda Rio Grande", rating: 5, title: "Recomendo", comment: "Paguei no Pix com desconto e o motoboy entregou rapidinho.", daysAgo: 31 },
  { product: "airfryer-oven-12", name: "Vinícius Raupp", city: "Curitiba · Bigorrilho", rating: 5, title: "Substituiu meu forno", comment: "O espeto giratório faz um frango maravilhoso. Muito versátil.", daysAgo: 12 },
  { product: "airfryer-4", name: "Larissa Pacheco", city: "Curitiba · Capão Raso", rating: 4, title: "Ótima para duas pessoas", comment: "Compacta e prática. Para família grande talvez fique pequena.", daysAgo: 7 },
  { product: "airfryer-4", name: "Fábio Steinmetz", city: "Almirante Tamandaré", rating: 5, title: "Custo-benefício", comment: "Simples, sem frescura e funciona muito bem.", daysAgo: 28 },
  { product: "cafeteira-expresso-15", name: "Ana Clara Weber", city: "Curitiba · Batel", rating: 5, title: "Café de cafeteria em casa", comment: "Crema perfeita e o vaporizador faz uma espuma ótima para cappuccino.", daysAgo: 6 },
  { product: "cafeteira-expresso-15", name: "Gilberto Ramos", city: "São José dos Pinhais", rating: 4, title: "Muito boa", comment: "Leva um tempinho para pegar o jeito da moagem, mas depois o café fica excelente.", daysAgo: 34 },
  { product: "liquidificador-1200", name: "Cristiane Lopes", city: "Curitiba · Fazendinha", rating: 5, title: "Tritura gelo fácil", comment: "Faço vitamina com fruta congelada sem problema. Jarra de vidro pesada e resistente.", daysAgo: 4 },
  { product: "mixer-3em1", name: "Natália Brandt", city: "Pinhais", rating: 5, title: "Prático", comment: "Uso para sopas direto na panela. O batedor de claras também é ótimo.", daysAgo: 19 },
  { product: "batedeira-planetaria", name: "Mônica Hoffmann", city: "Curitiba · Mossunguê", rating: 5, title: "Linda e potente", comment: "Bate massa de pão sem esforço. A cor vermelha ficou linda na bancada.", daysAgo: 10 },
  { product: "tv-55-4k", name: "Leandro Silveira", city: "Curitiba · Água Verde", rating: 5, title: "Imagem incrível", comment: "4K muito nítido e os apps funcionam rápido. Frete grátis ajudou na decisão.", daysAgo: 5 },
  { product: "tv-55-4k", name: "Rafaela Moura", city: "Campo Largo", rating: 4, title: "Muito boa", comment: "Ótima TV. O som é bom, mas vou comprar uma soundbar para completar.", daysAgo: 26 },
  { product: "aspirador-vertical", name: "Débora Linhares", city: "Curitiba · Pilarzinho", rating: 4, title: "Leve e prático", comment: "Uso no dia a dia e no carro. O reservatório podia ser um pouco maior.", daysAgo: 16 },
  { product: "robo-aspirador", name: "Caio Wendt", city: "Curitiba · Ecoville", rating: 5, title: "Vale muito a pena", comment: "Mapeou a casa inteira na primeira vez e passa pano muito bem.", daysAgo: 8 },
  { product: "purificador-gelada", name: "Adriana Kowalski", city: "Colombo", rating: 5, title: "Água gelada de verdade", comment: "Gela muito bem e acabou com a compra de garrafões.", daysAgo: 21 },
  { product: "lava-loucas-8", name: "Otávio Pires", city: "Curitiba · Água Verde", rating: 4, title: "Economiza tempo", comment: "Cabe a louça do dia de um casal. Lava bem, só não coloque panelas muito grandes.", daysAgo: 29 },
  // Aguardando moderação
  { product: "airfryer-55", name: "Jéssica Santana", city: "Curitiba · Tatuquara", rating: 5, title: "Amei", comment: "Chegou hoje e já fiz frango. Muito boa!", daysAgo: 0, approved: false },
  { product: "gel-duplex-375", name: "Cleber Antunes", city: "Piraquara", rating: 3, title: "Boa, mas a entrega demorou", comment: "A geladeira é ótima, mas o pedido saiu só no dia seguinte.", daysAgo: 1, approved: false },
  { product: "ar-12k-inverter", name: "Luana Dias", city: "Curitiba · Cajuru", rating: 5, title: "Recomendo", comment: "Silencioso e gela rápido. Atendimento nota 10.", daysAgo: 1, approved: false },
  { product: "tv-55-4k", name: "Wagner Teles", city: "Quatro Barras", rating: 2, title: "Controle veio com defeito", comment: "A TV é boa, mas o controle remoto não funcionou. Já chamei no WhatsApp.", daysAgo: 0, approved: false },
];

export type SeedCustomer = { name: string; phone: string; email?: string; doc?: string };

export const CUSTOMERS: SeedCustomer[] = [
  { name: "Ana Paula Ribeiro", phone: "41998120431", email: "ana.ribeiro@exemplo.com.br" },
  { name: "Bruno Kowalski", phone: "41997365210" },
  { name: "Camila Andrade", phone: "41999041872", email: "camila.andrade@exemplo.com.br" },
  { name: "Diego Zanetti", phone: "41996257314" },
  { name: "Eduarda Schmitt", phone: "41988714502", email: "eduarda.schmitt@exemplo.com.br" },
  { name: "Fernando Lacerda", phone: "41991830967" },
  { name: "Gabriela Wolff", phone: "41995472318", email: "gabi.wolff@exemplo.com.br" },
  { name: "Henrique Bortolini", phone: "41987603145" },
  { name: "Isabela Martins", phone: "41992318874", email: "isabela.martins@exemplo.com.br" },
  { name: "João Pedro Nascimento", phone: "41998874120" },
  { name: "Karina Toledo", phone: "41996603271", email: "karina.toledo@exemplo.com.br" },
  { name: "Lucas Petrowski", phone: "41984527716" },
  { name: "Mariana Gnoatto", phone: "41999716503" },
  { name: "Natália Kloster", phone: "41991148860", email: "natalia.kloster@exemplo.com.br" },
  { name: "Otávio Ribas", phone: "41995539021" },
];

export type SeedAddress = {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  reference?: string;
  lat: number;
  lng: number;
};

export const ADDRESSES: SeedAddress[] = [
  { cep: "80620010", street: "Avenida República Argentina", number: "1520", complement: "Apto 803", neighborhood: "Água Verde", city: "Curitiba", lat: -25.4528, lng: -49.2847 },
  { cep: "80730000", street: "Rua Padre Anchieta", number: "2050", complement: "Apto 1202", neighborhood: "Bigorrilho", city: "Curitiba", lat: -25.4338, lng: -49.2967 },
  { cep: "80035130", street: "Avenida Paraná", number: "1210", neighborhood: "Cabral", city: "Curitiba", reference: "Portão cinza ao lado da farmácia", lat: -25.4085, lng: -49.2583 },
  { cep: "81070000", street: "Rua João Bettega", number: "845", neighborhood: "Portão", city: "Curitiba", lat: -25.4726, lng: -49.3012 },
  { cep: "82020000", street: "Avenida Manoel Ribas", number: "5620", neighborhood: "Santa Felicidade", city: "Curitiba", lat: -25.4037, lng: -49.3296 },
  { cep: "81730000", street: "Avenida Marechal Floriano Peixoto", number: "7480", neighborhood: "Boqueirão", city: "Curitiba", lat: -25.5034, lng: -49.2372 },
  { cep: "80030340", street: "Rua Augusto Stresser", number: "930", complement: "Casa 2", neighborhood: "Juvevê", city: "Curitiba", lat: -25.4158, lng: -49.2611 },
  { cep: "83005000", street: "Rua XV de Novembro", number: "1240", neighborhood: "Centro", city: "São José dos Pinhais", lat: -25.5347, lng: -49.2063 },
  { cep: "83323000", street: "Avenida Camilo di Lellis", number: "780", neighborhood: "Centro", city: "Pinhais", lat: -25.4441, lng: -49.1925 },
  { cep: "83414000", street: "Rua XV de Novembro", number: "310", neighborhood: "Centro", city: "Colombo", lat: -25.2919, lng: -49.2244 },
  { cep: "83702040", street: "Avenida Victor do Amaral", number: "1510", neighborhood: "Centro", city: "Araucária", lat: -25.5928, lng: -49.4103 },
  { cep: "83820000", street: "Avenida das Américas", number: "2040", neighborhood: "Nações", city: "Fazenda Rio Grande", reference: "Em frente ao mercado", lat: -25.6563, lng: -49.3081 },
  { cep: "83601000", street: "Rua Centenário", number: "905", neighborhood: "Centro", city: "Campo Largo", lat: -25.4594, lng: -49.5276 },
];

export type SeedOrder = {
  daysAgo: number;
  hour: number; // horário local (Curitiba)
  customer: number;
  address: number | "PICKUP";
  items: [string, ("110V" | "220V")?, number?][];
  method: "ONLINE_STRIPE" | "PIX_MANUAL" | "PIX_ON_DELIVERY" | "CARD_ON_DELIVERY" | "CASH_ON_DELIVERY";
  status: "NEW" | "CONFIRMED" | "PREPARING" | "OUT_FOR_DELIVERY" | "READY_FOR_PICKUP" | "DELIVERED" | "CANCELED";
  coupon?: string;
  notes?: string;
  cancelNote?: string;
};

export const ORDERS: SeedOrder[] = [
  { daysAgo: 0, hour: 10, customer: 0, address: 0, items: [["airfryer-55", "220V", 1]], method: "PIX_ON_DELIVERY", status: "NEW", notes: "Interfone com defeito, me ligar quando chegar." },
  { daysAgo: 0, hour: 9, customer: 1, address: 7, items: [["ventilador-coluna-40", "110V", 2]], method: "CASH_ON_DELIVERY", status: "NEW" },
  { daysAgo: 0, hour: 8, customer: 2, address: 1, items: [["cafeteira-expresso-15", "220V", 1], ["mixer-3em1", "220V", 1]], method: "PIX_MANUAL", status: "CONFIRMED" },
  { daysAgo: 1, hour: 16, customer: 3, address: 8, items: [["fogao-5b-vidro", undefined, 1]], method: "CARD_ON_DELIVERY", status: "PREPARING" },
  { daysAgo: 1, hour: 11, customer: 4, address: 2, items: [["tv-55-4k", undefined, 1], ["soundbar-21", undefined, 1]], method: "ONLINE_STRIPE", status: "OUT_FOR_DELIVERY" },
  { daysAgo: 1, hour: 14, customer: 5, address: "PICKUP", items: [["micro-32-grill", "220V", 1]], method: "PIX_MANUAL", status: "READY_FOR_PICKUP" },
  { daysAgo: 2, hour: 15, customer: 6, address: 9, items: [["gel-1porta-300", "110V", 1]], method: "CASH_ON_DELIVERY", status: "OUT_FOR_DELIVERY", notes: "Deixar com o porteiro se eu não estiver." },
  { daysAgo: 3, hour: 10, customer: 7, address: 3, items: [["lava-seca-11", "220V", 1]], method: "ONLINE_STRIPE", status: "DELIVERED" },
  { daysAgo: 4, hour: 19, customer: 8, address: 4, items: [["airfryer-4", "220V", 1], ["liquidificador-1200", "220V", 1]], method: "PIX_ON_DELIVERY", status: "DELIVERED", coupon: "BEMVINDO10" },
  { daysAgo: 6, hour: 13, customer: 9, address: 10, items: [["ar-12k-inverter", undefined, 1]], method: "CARD_ON_DELIVERY", status: "DELIVERED" },
  { daysAgo: 7, hour: 9, customer: 10, address: 5, items: [["gel-duplex-375", "220V", 1]], method: "ONLINE_STRIPE", status: "DELIVERED", coupon: "TIRVO50" },
  { daysAgo: 9, hour: 17, customer: 11, address: 11, items: [["aquecedor-oleo-1500", "220V", 1], ["termoventilador-2000", "220V", 1]], method: "PIX_MANUAL", status: "DELIVERED" },
  { daysAgo: 11, hour: 12, customer: 0, address: 0, items: [["batedeira-planetaria", "220V", 1]], method: "CARD_ON_DELIVERY", status: "DELIVERED" },
  { daysAgo: 13, hour: 18, customer: 12, address: 6, items: [["robo-aspirador", undefined, 1]], method: "ONLINE_STRIPE", status: "CANCELED", cancelNote: "Pagamento online não concluído a tempo · por sistema" },
  { daysAgo: 16, hour: 10, customer: 13, address: "PICKUP", items: [["airfryer-55", "110V", 1], ["cafeteira-30x", "110V", 1]], method: "PIX_MANUAL", status: "DELIVERED" },
  { daysAgo: 19, hour: 15, customer: 14, address: 12, items: [["lavadora-12", "220V", 1]], method: "CASH_ON_DELIVERY", status: "DELIVERED", notes: "Rua sem saída, segunda casa à direita." },
  { daysAgo: 23, hour: 11, customer: 3, address: 8, items: [["purificador-gelada", undefined, 1]], method: "PIX_ON_DELIVERY", status: "CANCELED", cancelNote: "Cliente desistiu da compra antes da entrega · por Administrador" },
  { daysAgo: 27, hour: 14, customer: 5, address: 3, items: [["micro-32-grill", "110V", 1], ["forno-bancada-44", "110V", 1]], method: "CARD_ON_DELIVERY", status: "DELIVERED", coupon: "FRETEGRATIS" },
];

export const NEWSLETTER = [
  "ana.ribeiro@exemplo.com.br",
  "camila.andrade@exemplo.com.br",
  "eduarda.schmitt@exemplo.com.br",
  "gabi.wolff@exemplo.com.br",
  "isabela.martins@exemplo.com.br",
  "karina.toledo@exemplo.com.br",
  "natalia.kloster@exemplo.com.br",
  "roberto.kuhn@exemplo.com.br",
  "juliana.prestes@exemplo.com.br",
  "thiago.borges@exemplo.com.br",
  "fernanda.kloss@exemplo.com.br",
  "leandro.silveira@exemplo.com.br",
];
