export async function getServerSideProps() {
  return {
    redirect: {
      destination: '/coach-command-center',
      permanent: true,
    },
  };
}

export default function CoachesPage() {
  return null;
}
