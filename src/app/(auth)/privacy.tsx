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
          {`El responsable del tratamiento de los datos personales recogidos a través de ${APP_DISPLAY_NAME} será el titular del proyecto indicado en el registro de actividades de tratamiento (RAT), cuyos datos de contacto se publicarán antes del lanzamiento comercial.`}
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Datos que tratamos">
        <LegalParagraph>
          Datos de cuenta (email, nombre visible, foto de perfil opcional), teléfono si lo
          facilitas, preferencias de notificación, historial de partidas en las que participas,
          resultados, reportes y datos técnicos (identificadores de dispositivo para push, registros
          de errores anonimizados).
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
          misma partida que tú, conforme a la configuración de privacidad del servicio.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="8. Tus derechos">
        <LegalParagraph>
          Puedes ejercer los derechos de acceso, rectificación, supresión, limitación, oposición y
          portabilidad, así como retirar el consentimiento cuando proceda, contactando con el
          responsable. También puedes presentar reclamación ante la AEPD (www.aepd.es).
        </LegalParagraph>
        <LegalParagraph>
          La eliminación completa de cuenta (derecho de supresión) estará disponible desde la app en
          una versión posterior del producto.
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
          {`Para ejercer derechos o consultas de privacidad relacionadas con ${APP_DISPLAY_NAME}, utiliza el canal de contacto que se indique en la app antes del lanzamiento público.`}
        </LegalParagraph>
      </LegalSection>
    </LegalScreenLayout>
  )
}
