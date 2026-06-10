import { APP_DISPLAY_NAME } from '@/constants/app'
import {
  LegalParagraph,
  LegalScreenLayout,
  LegalSection,
} from '@/components/legal/LegalScreenLayout'

export default function PrivacyScreen() {
  return (
    <LegalScreenLayout title="Política de privacidad">
      <LegalSection heading="1. Responsable del tratamiento">
        <LegalParagraph>
          {`El responsable del tratamiento de los datos personales recogidos a través de ${APP_DISPLAY_NAME} es Javier Peña Gómez (desarrollador indicado en las fichas de Google Play y App Store). Puedes contactar en japenago@gmail.com.`}
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Datos que tratamos">
        <LegalParagraph>
          Datos de cuenta (email, nombre visible, foto de perfil opcional), teléfono si lo
          facilitas, preferencias de notificación, historial de partidas y torneos en los que
          participas, resultados, reportes, feedback que envíes y datos técnicos (identificadores de
          dispositivo para push, registros de errores anonimizados).
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="3. Finalidades">
        <LegalParagraph>
          Prestación del servicio (crear y unirse a partidas, mostrar perfiles a participantes),
          autenticación, notificaciones sobre tu actividad, seguridad, moderación de reportes y
          mejora del producto (analítica agregada y monitorización de errores).
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="4. Base legal (RGPD)">
        <LegalParagraph>
          Ejecución del contrato (uso de la app), consentimiento (notificaciones marketing si las
          hubiera, registro), interés legítimo (seguridad, prevención de fraude) y obligación legal
          cuando aplique.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="5. Conservación">
        <LegalParagraph>
          Conservamos los datos mientras mantengas la cuenta activa y el tiempo necesario para
          obligaciones legales o reclamaciones. Tras la eliminación de cuenta se procederá al
          borrado o anonimización salvo bloqueos legales.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="6. Destinatarios y encargados">
        <LegalParagraph>
          Utilizamos proveedores que actúan como encargados del tratamiento con acuerdos adecuados,
          entre otros: Supabase (base de datos, autenticación y almacenamiento), Expo/EAS (builds y
          notificaciones push), Sentry (errores) y PostHog (analítica de producto). No vendemos tus
          datos personales a terceros.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="7. Visibilidad del teléfono">
        <LegalParagraph>
          Si incluyes tu número de teléfono, solo será visible para usuarios que participen en la
          misma partida confirmada que tú, conforme a la configuración de privacidad del servicio.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="8. Tus derechos">
        <LegalParagraph>
          Puedes ejercer los derechos de acceso, rectificación, supresión, limitación, oposición y
          portabilidad, así como retirar el consentimiento cuando proceda, escribiendo a
          japenago@gmail.com. También puedes presentar reclamación ante la AEPD (www.aepd.es).
        </LegalParagraph>
        <LegalParagraph>
          Puedes eliminar tu cuenta desde la propia app (Perfil → Eliminar cuenta). El historial de
          partidas y torneos se anonimiza para no perjudicar a otros jugadores; el resto de datos
          personales se borra conforme a esta política.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="9. Seguridad">
        <LegalParagraph>
          Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito, control de
          acceso por filas en base de datos, autenticación segura). Ningún sistema es infalible;
          notifícanos incidentes de seguridad si los detectas.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="10. Cambios en esta política">
        <LegalParagraph>
          Podemos actualizar esta política. Publicaremos la versión vigente en la app con la fecha
          de revisión. Te recomendamos revisarla periódicamente.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="11. Contacto">
        <LegalParagraph>
          {`Para ejercer derechos o consultas de privacidad relacionadas con ${APP_DISPLAY_NAME}, escribe a japenago@gmail.com.`}
        </LegalParagraph>
      </LegalSection>
    </LegalScreenLayout>
  )
}
