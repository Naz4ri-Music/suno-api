'use client';
import 'swagger-ui-react/swagger-ui.css';
import dynamic from "next/dynamic";
import { appBasePath } from "@/lib/appConfig";

type Props = {
  spec: Record<string, any>,
};

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false });

function Swagger({ spec }: Props) {
  const hydratedSpec = {
    ...spec,
    servers: [
      {
        url: appBasePath || '/'
      }
    ]
  };

  return <SwaggerUI spec={hydratedSpec} requestInterceptor={(req) => {
    // Remove cookies before sending requests
    req.credentials = 'omit';
    console.log(req);
    return req;
  }} />;
}

export default Swagger;
