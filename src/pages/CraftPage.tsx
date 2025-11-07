
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Grid, Card, CardContent, Avatar, Typography, Box, Chip, Tabs, Tab, IconButton } from '@mui/material';
import { User, Briefcase, Star, MapPin, ExternalLink } from 'lucide-react';

import { CraftPageSkeleton } from '@/components/skeletons/CraftPageSkeleton';
import { ProjectCard } from '@/components/ProjectCard'; // Assuming this is the correct path

const mockProfessionals = [
  {
    id: 1, name: 'Alice Johnson', location: 'Los Angeles, CA', bio: 'Award-winning director with over 10 years of experience in feature films and commercials. Passionate about storytelling and visual arts.',
    avatar: '/avatars/avatar-1.jpg', skills: ['Directing', 'Editing', 'Writing'], rating: 4.9, projects: 12
  },
  {
    id: 2, name: 'David Lee', location: 'New York, NY', bio: 'Cinematographer known for a unique visual style. Has worked with major brands and independent filmmakers.',
    avatar: '/avatars/avatar-2.jpg', skills: ['Cinematography', 'Color Grading'], rating: 4.8, projects: 18
  },
  {
    id: 3, name: 'Maria Garcia', location: 'London, UK', bio: 'Creative producer with a knack for bringing ambitious projects to life. Specialties include budgeting and team management.',
    avatar: '/avatars/avatar-3.jpg', skills: ['Producing', 'Budgeting', 'Casting'], rating: 4.9, projects: 9
  },
];

const mockProjects = [
  {
    id: 1, title: 'Starlight', description: 'A sci-fi short film about a journey to a distant star.',
    imageUrl: '/projects/project-1.jpg', author: 'Alice Johnson', authorAvatar: '/avatars/avatar-1.jpg', likes: 120, comments: 15
  },
  {
    id: 2, title: 'Urban Dreams', description: 'A documentary exploring the vibrant street art scene in NYC.',
    imageUrl: '/projects/project-2.jpg', author: 'David Lee', authorAvatar: '/avatars/avatar-2.jpg', likes: 250, comments: 32
  },
  {
    id: 3, title: 'The Heirloom', description: 'A period drama centered around a mysterious family inheritance.',
    imageUrl: '/projects/project-3.jpg', author: 'Maria Garcia', authorAvatar: '/avatars/avatar-3.jpg', likes: 180, comments: 22
  },
];


const CraftPage = () => {
  const { craftName } = useParams<{ craftName: string }>();
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const formattedCraftName = craftName?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Craft';

  useEffect(() => {
    // This will now run immediately without an artificial delay.
    setProfessionals(mockProfessionals);
    setProjects(mockProjects);
    setLoading(false);
  }, [formattedCraftName]);

  if (loading) {
    return <CraftPageSkeleton />;
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          {formattedCraftName}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Discover top professionals and noteworthy projects in {formattedCraftName}.
        </Typography>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 4 }}>
        <Tabs value={tabValue} onChange={handleTabChange} centered>
          <Tab label="Professionals" icon={<User />} iconPosition="start" />
          <Tab label="Projects" icon={<Briefcase />} iconPosition="start" />
        </Tabs>
      </Box>

      {tabValue === 0 && (
        <Grid container spacing={4}>
          {professionals.map((pro) => (
            <Grid item xs={12} md={6} lg={4} key={pro.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar src={pro.avatar} sx={{ width: 60, height: 60, mr: 2 }} />
                    <Box>
                      <Typography variant="h6">{pro.name}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                        <MapPin size={16} style={{ marginRight: '4px' }}/>
                        <Typography variant="body2">{pro.location}</Typography>
                      </Box>
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{pro.bio}</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                    {pro.skills.map((skill: string) => <Chip key={skill} label={skill} size="small" />)}
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'text.secondary' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Star size={16} style={{ marginRight: '4px' }} color="#FFC107"/>
                      <Typography variant="body2">{pro.rating}</Typography>
                    </Box>
                    <Typography variant="body2">{pro.projects} projects</Typography>
                    <IconButton component={Link} to={`/professionals/${pro.id}`} aria-label={`View profile of ${pro.name}`} size="small">
                      <ExternalLink size={16} />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {tabValue === 1 && (
        <Grid container spacing={4}>
          {projects.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <ProjectCard project={project} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default CraftPage;
