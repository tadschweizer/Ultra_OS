export default function CoachesRedirectPage() {
  return null;
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/coach-command-center',
      permanent: false,
    },
  };
}
