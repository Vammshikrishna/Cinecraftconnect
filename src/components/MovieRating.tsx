
import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import StarRating from './StarRating';

interface MovieRatingProps {
  title: string;
  rating: number;
  releaseDate: string;
  type: 'Movie' | 'Short Film';
}

const MovieRating = ({ title, rating, releaseDate, type }: MovieRatingProps) => {
  return (
    <Card className="w-full bg-black/20 backdrop-blur-sm border-white/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="font-semibold text-lg">{title}</h3>
        <span className="text-sm text-gray-400">{type}</span>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <StarRating 
            title={title}
            type={type}
            initialRating={rating} 
            showValue 
            size={20} 
          />
          <span className="text-sm text-gray-400">Released: {releaseDate}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default MovieRating;
