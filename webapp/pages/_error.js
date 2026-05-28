import * as Sentry from "@sentry/nextjs";
import NextErrorComponent from "next/error";

const CustomError = ({ statusCode }) => (
  <NextErrorComponent statusCode={statusCode} />
);

CustomError.getInitialProps = async (contextData) => {
  await Sentry.captureUnderscoreErrorException(contextData);
  return NextErrorComponent.getInitialProps(contextData);
};

export default CustomError;
