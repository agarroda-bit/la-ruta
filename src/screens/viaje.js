// Diálogos de viaje que salen en el mapa: al llegar por primera vez y al desbloquear cada etapa.
export const VIAJE = {
  inicio: [
    { who: 0, text: 'Trece horas de avión. He visto cuatro películas y la mitad de otra.' },
    { who: 1, text: 'Yo he dormido sentado encima de mi propia rodilla. No la siento.' },
    { who: 0, text: 'Plan: Phuket, Koh Samui, Bangkok, un combate de Muay Thai, Macao y Shanghái.' },
    { who: 1, text: '¿Y dormir cuándo?' },
    { who: 0, text: 'En Shanghái. O en el avión de vuelta. Toca el 1 del mapa y vamos.' },
  ],
  samui: [
    { who: 1, text: 'Qué fiesta. Creo que todavía tengo confeti en las orejas.' },
    { who: 0, text: 'Ahora, Koh Samui. Barca de cola larga entre islas.' },
    { who: 1, text: '¿Cola larga? ¿Como la del súper?' },
  ],
  bangkok: [
    { who: 0, text: 'Bangkok de noche. Dicen que un tuk-tuk es un taxi con ganas de aventura.' },
    { who: 1, text: 'Y yo he leído que aquí el picante «suave» es como nuestro «socorro».' },
  ],
  muaythai: [
    { who: 1, text: 'Esta noche hay combate en el estadio. Y nos han dejado subir al ring.' },
    { who: 0, text: 'Primero el wai kru: el baile para dar las gracias. Con respeto, ¿eh?' },
    { who: 1, text: 'Yo con respeto bailo fatal, pero con mucho cariño.' },
  ],
  macao: [
    { who: 0, text: 'Entramos en China por Cantón y Macao. Cambio de moneda, de idioma y de carril.' },
    { who: 1, text: 'He alquilado un coche pequeñito. Y un taxista nos mira raro desde el ferry.' },
  ],
  shanghai: [
    { who: 1, text: 'Última etapa: tren bala a Shanghái. Cuatrocientos treinta por hora.' },
    { who: 0, text: 'Más rápido que mi jet lag. Por fin algo le gana.' },
  ],
};
