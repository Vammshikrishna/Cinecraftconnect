
import { useState, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  title: string;
  component: ReactNode;
  validation?: () => boolean;
}

interface MultiStepFormProps {
  steps: Step[];
  onComplete: () => void;
  className?: string;
}

export const MultiStepForm = ({ steps, onComplete, className }: MultiStepFormProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const nextStep = () => {
    const currentValidation = steps[currentStep].validation;
    if (currentValidation && !currentValidation()) {
      return;
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className={cn("max-w-2xl mx-auto", className)}>
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div
              key={index}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                index <= currentStep
                  ? "bg-cinesphere-purple text-white"
                  : "bg-gray-600 text-gray-400"
              )}
            >
              {index + 1}
            </div>
          ))}
        </div>
        <div className="relative">
          <div className="absolute top-0 left-0 h-1 bg-gray-600 rounded-full w-full"></div>
          <div 
            className="absolute top-0 left-0 h-1 bg-gradient-to-r from-cinesphere-purple to-cinesphere-blue rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step Content */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-6">
          {steps[currentStep].title}
        </h2>
        {steps[currentStep].component}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        
        <Button
          onClick={nextStep}
          className="flex items-center bg-cinesphere-purple hover:bg-cinesphere-purple/90"
        >
          {currentStep === steps.length - 1 ? 'Complete' : 'Next'}
          {currentStep < steps.length - 1 && <ChevronRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};
